/** Text-to-image transports. No provider SDKs, model-controlled URLs, shell interpolation or automatic submission retries. */
import { randomUUID } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { sniffImage } from './images.js';
export const IMAGE_PROVIDERS = {
    openai: ['OpenAI / compatible Images', 'https://api.openai.com/v1', 'gpt-image-1'],
    azure: ['Azure OpenAI Images', '', ''],
    modelscope: ['ModelScope 魔搭', 'https://api-inference.modelscope.cn/v1', 'Qwen/Qwen-Image-2.1'],
    dashscope: ['Alibaba DashScope / Qwen / Wan', 'https://dashscope.aliyuncs.com/api/v1', 'qwen-image-plus'],
    gemini: ['Google Gemini image', 'https://generativelanguage.googleapis.com/v1beta', ''],
    imagen: ['Google Imagen (Gemini API)', 'https://generativelanguage.googleapis.com/v1beta', ''],
    vertex: ['Google Vertex Imagen (Bearer token)', '', ''],
    openrouter: ['OpenRouter image chat', 'https://openrouter.ai/api/v1', ''],
    bfl: ['Black Forest Labs FLUX', 'https://api.bfl.ai/v1', 'flux-2-pro'],
    fal: ['fal.ai queue', 'https://queue.fal.run', 'fal-ai/flux/dev'],
    replicate: ['Replicate predictions', 'https://api.replicate.com/v1', 'black-forest-labs/flux-schnell'],
    stability: ['Stability AI', 'https://api.stability.ai/v2beta', 'core'],
    ideogram: ['Ideogram v3', 'https://api.ideogram.ai', 'ideogram-v3'],
    huggingface: ['Hugging Face hf-inference', 'https://router.huggingface.co/hf-inference/models', ''],
    a1111: ['AUTOMATIC1111 / Forge API', 'http://127.0.0.1:7860', ''],
    comfyui: ['ComfyUI API workflow', 'http://127.0.0.1:8188', ''],
    custom: ['Custom HTTP / async JSON', '', ''],
    command: ['Local program / Diffusers / cloud CLI', '', ''],
};
const MAX_JSON = 72 * 1024 * 1024;
const pathValue = (v, path) => path.split('.').filter(Boolean).reduce((a, k) => a?.[k], v);
export function imageOptions(text) {
    const v = JSON.parse(text || '{}');
    if (!v || Array.isArray(v) || typeof v !== 'object')
        throw new Error('高级参数必须是 JSON 对象');
    return v;
}
/** Exact placeholders retain numeric/object types; interpolated text is never evaluated as code. */
export function imageTemplate(value, vars) {
    if (Array.isArray(value))
        return value.map(v => imageTemplate(v, vars));
    if (value && typeof value === 'object')
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, imageTemplate(v, vars)]));
    if (typeof value !== 'string')
        return value;
    const exact = /^\{\{([A-Za-z]+)\}\}$/.exec(value);
    if (exact) {
        if (!(exact[1] in vars))
            throw new Error('未知模板变量 ' + exact[1]);
        return vars[exact[1]];
    }
    return value.replace(/\{\{([A-Za-z]+)\}\}/g, (_, key) => { if (!(key in vars))
        throw new Error('未知模板变量 ' + key); return String(vars[key]); });
}
function httpUrl(value) {
    const u = new URL(value);
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password)
        throw new Error('接口必须是 HTTP(S) 地址，凭据请填写到密钥栏');
    return u;
}
export function safeProviderError(error, key) {
    let message = error instanceof Error ? error.message : '图片生成失败';
    if (key)
        message = message.split(key).join('[redacted]');
    return message.replace(/https?:\/\/[^\s"<>]+/g, '[remote URL]').slice(0, 600);
}
async function bytesOf(response, max, signal) {
    if (Number(response.headers.get('content-length') || 0) > max)
        throw new Error('响应超出大小上限');
    const reader = response.body?.getReader();
    if (!reader)
        throw new Error('服务返回空响应');
    const chunks = [];
    let size = 0;
    try {
        while (true) {
            signal.throwIfAborted();
            const next = await reader.read();
            if (next.done)
                break;
            size += next.value.length;
            if (size > max)
                throw new Error('响应超出大小上限');
            chunks.push(next.value);
        }
    }
    finally {
        await reader.cancel().catch(() => { });
    }
    return Buffer.concat(chunks);
}
class Transport {
    s;
    signal;
    base;
    constructor(s, signal) {
        this.s = s;
        this.signal = signal;
        this.base = s.baseUrl.trim().replace(/\/$/, '');
    }
    url(path) { return this.base + path; }
    async request(url, body, headers = {}, method, authenticate = true) {
        const target = httpUrl(url);
        const same = target.origin === httpUrl(this.base).origin;
        if (authenticate && !same)
            throw new Error('任务地址跨域；拒绝转发 API 密钥。请配置同域任务地址');
        this.signal.throwIfAborted();
        const multipart = body instanceof FormData;
        const bearer = !['azure', 'gemini', 'imagen', 'bfl', 'ideogram'].includes(this.s.provider);
        const auth = authenticate && bearer && this.s.apiKey ? { Authorization: 'Bearer ' + this.s.apiKey } : {};
        const response = await fetch(target, { method: method ?? (body === undefined ? 'GET' : 'POST'),
            headers: { ...auth, ...(body === undefined || multipart ? {} : { 'Content-Type': 'application/json' }), ...headers },
            body: body === undefined ? undefined : multipart ? body : JSON.stringify(body), signal: this.signal, redirect: 'error' });
        if (!response.ok) {
            // Do not echo provider bodies: these can contain tokens, signed URLs or private prompts.
            await response.body?.cancel();
            throw new Error('生图接口 HTTP ' + response.status + (response.status === 429 ? '：额度或速率限制' : '；请核对模型、权限和高级参数'));
        }
        return response;
    }
    async json(url, body, headers, method) {
        const bytes = await bytesOf(await this.request(url, body, headers, method), MAX_JSON, this.signal);
        try {
            return JSON.parse(bytes.toString('utf8'));
        }
        catch {
            throw new Error('生图接口未返回有效JSON');
        }
    }
    async poll(url, inspect, headers) {
        for (;;) {
            await delay(1500, undefined, { signal: this.signal });
            const v = await this.json(url, undefined, headers);
            const state = inspect(v);
            if (state.fail)
                throw new Error('远端生成任务失败或被内容规则拒绝；请在提供商控制台查看原因');
            if (state.done)
                return state.result ?? v;
        }
    }
    async image(source) {
        const max = this.s.maxMB * 1024 * 1024;
        const raw = source.replace(/^data:image\/[\w.+-]+;base64,/, '');
        if (!/^https?:\/\//.test(source)) {
            if (raw.length > Math.ceil(max / 3) * 4 + 4 || !/^[A-Za-z0-9+/\s]*={0,2}$/.test(raw))
                throw new Error('无效或过大的图片编码');
            const b = Buffer.from(raw, 'base64');
            if (b.length > max)
                throw new Error('图片超过大小上限');
            return b;
        }
        // Signed result URLs are downloaded without provider credentials. No redirects/leaked auth.
        return bytesOf(await this.request(source, undefined, {}, 'GET', false), max, this.signal);
    }
}
const sources = (v) => {
    if (typeof v === 'string')
        return [v];
    if (Array.isArray(v))
        return v.flatMap(sources);
    if (v && typeof v === 'object') {
        if (typeof v.b64_json === 'string')
            return [v.b64_json];
        if (typeof v.url === 'string')
            return [v.url];
        if (typeof v.image === 'string')
            return [v.image];
        if (v.image?.url)
            return [String(v.image.url)];
        if (v.image_url?.url)
            return [String(v.image_url.url)];
        if (typeof v.base64 === 'string')
            return [v.base64];
    }
    return [];
};
async function generate(t, r, options) {
    const s = t.s, prompt = r.prompt, size = r.size || (typeof options.size === 'string' ? options.size : '1024x1024');
    if (!/^\d{2,4}x\d{2,4}$/.test(size))
        throw new Error('图片尺寸须为宽x高，例如1024x1024');
    const [width, height] = size.split('x').map(Number);
    const body = (defaults) => ({ ...options, ...defaults });
    switch (s.provider) {
        case 'openai':
        case 'azure': {
            const url = s.provider === 'azure' ? t.base : t.url('/images/generations');
            const headers = s.provider === 'azure' ? { 'api-key': s.apiKey } : {};
            return sources((await t.json(url, body({ ...(s.model ? { model: s.model } : {}), prompt, n: 1, size }), headers)).data);
        }
        case 'modelscope': {
            const submit = await t.json(t.url('/images/generations'), body({ model: s.model, prompt, size, ...(r.negativePrompt ? { negative_prompt: r.negativePrompt } : {}) }), { 'X-ModelScope-Async-Mode': 'true' });
            if (!submit.task_id)
                throw new Error('魔搭未返回 task_id');
            const done = await t.poll(t.url('/tasks/' + encodeURIComponent(submit.task_id)), v => ({ done: v.task_status === 'SUCCEED', fail: ['FAILED', 'CANCELED'].includes(v.task_status) }), { 'X-ModelScope-Task-Type': 'image_generation' });
            return sources(done.output_images);
        }
        case 'dashscope': {
            const input = { messages: [{ role: 'user', content: [{ text: prompt }] }] };
            const v = await t.json(t.url('/services/aigc/multimodal-generation/generation'), { model: s.model, input, parameters: { ...options, n: 1, size: size.replace('x', '*'), ...(r.negativePrompt ? { negative_prompt: r.negativePrompt } : {}) } }, { 'X-DashScope-Async': 'enable' });
            const done = v.output?.task_id ? await t.poll(t.url('/tasks/' + encodeURIComponent(v.output.task_id)), x => ({ done: x.output?.task_status === 'SUCCEEDED', fail: ['FAILED', 'CANCELED', 'UNKNOWN'].includes(x.output?.task_status) })) : v;
            return sources(done.output?.results).concat((done.output?.choices ?? []).flatMap((c) => (c.message?.content ?? []).flatMap((b) => sources(b.image))));
        }
        case 'gemini':
        case 'imagen':
        case 'vertex': {
            const modelPath = '/models/' + encodeURIComponent(s.model);
            if (s.provider === 'gemini') {
                const v = await t.json(t.url(modelPath + ':generateContent'), { ...options, contents: [{ parts: [{ text: prompt }] }], generationConfig: { ...options.generationConfig, responseModalities: ['TEXT', 'IMAGE'] } }, { 'x-goog-api-key': s.apiKey });
                return (v.candidates ?? []).flatMap((c) => (c.content?.parts ?? []).flatMap((p) => sources(p.inlineData?.data ?? p.inline_data?.data)));
            }
            const url = s.provider === 'vertex' ? t.base : t.url(modelPath + ':predict');
            const v = await t.json(url, { instances: [{ prompt }], parameters: { ...options, sampleCount: 1 } }, s.provider === 'vertex' ? {} : { 'x-goog-api-key': s.apiKey });
            return (v.predictions ?? []).flatMap((p) => sources(p.bytesBase64Encoded));
        }
        case 'openrouter': {
            const v = await t.json(t.url('/chat/completions'), body({ model: s.model, messages: [{ role: 'user', content: prompt }], modalities: ['image', 'text'], stream: false }));
            return (v.choices ?? []).flatMap((c) => (c.message?.images ?? []).flatMap((p) => sources(p.image_url?.url)));
        }
        case 'bfl': {
            const h = { 'x-key': s.apiKey };
            const v = await t.json(t.url('/' + encodeURIComponent(s.model)), body({ prompt, width, height }), h);
            if (!v.polling_url)
                throw new Error('BFL 未返回 polling_url');
            const done = await t.poll(v.polling_url, x => ({ done: x.status === 'Ready', fail: ['Error', 'Failed', 'Request Moderated', 'Content Moderated'].includes(x.status) }), h);
            return sources(done.result?.sample);
        }
        case 'fal': {
            const h = { Authorization: 'Key ' + s.apiKey };
            const v = await t.json(t.url('/' + s.model), body({ prompt, num_images: 1, image_size: { width, height } }), h);
            if (!v.status_url || !v.response_url)
                throw new Error('fal 未返回任务地址');
            await t.poll(v.status_url, x => ({ done: x.status === 'COMPLETED', fail: ['FAILED', 'CANCELLED'].includes(x.status) }), h);
            return sources((await t.json(v.response_url, undefined, h)).images);
        }
        case 'replicate': {
            const version = typeof options.version === 'string' ? options.version : '';
            const input = { ...options, prompt };
            delete input.version;
            const v = await t.json(version ? t.url('/predictions') : t.url('/models/' + s.model + '/predictions'), version ? { version, input } : { input }, { Prefer: 'wait=60' });
            const done = v.status === 'succeeded' ? v : await t.poll(v.urls?.get, x => ({ done: x.status === 'succeeded', fail: ['failed', 'canceled'].includes(x.status) }));
            return sources(done.output);
        }
        case 'stability':
        case 'ideogram': {
            const form = new FormData();
            for (const [key, value] of Object.entries(body({ prompt, ...(s.provider === 'stability' ? { output_format: 'png' } : {}) })))
                form.set(key, typeof value === 'string' ? value : JSON.stringify(value));
            const response = await t.request(s.provider === 'stability' ? t.url('/stable-image/generate/' + s.model) : t.url('/v1/' + s.model + '/generate'), form, s.provider === 'ideogram' ? { 'Api-Key': s.apiKey } : { Accept: 'image/*' });
            const bytes = await bytesOf(response, s.provider === 'stability' ? s.maxMB * 1024 * 1024 : MAX_JSON, t.signal);
            if (s.provider === 'stability')
                return [bytes];
            return sources(JSON.parse(bytes.toString('utf8')).data);
        }
        case 'huggingface': return [await bytesOf(await t.request(t.url('/' + s.model), { inputs: prompt, parameters: options }), s.maxMB * 1024 * 1024, t.signal)];
        case 'a1111': return sources((await t.json(t.url('/sdapi/v1/txt2img'), body({ prompt, negative_prompt: r.negativePrompt || '', width, height, batch_size: 1, n_iter: 1 }))).images);
        case 'comfyui': {
            if (!options.workflow)
                throw new Error('ComfyUI 需要高级参数中的 workflow（API 格式工作流）');
            const workflow = imageTemplate(options.workflow, { prompt, negativePrompt: r.negativePrompt || '', width, height, seed: Math.floor(Math.random() * 2 ** 32) });
            const v = await t.json(t.url('/prompt'), { prompt: workflow, client_id: randomUUID() });
            if (!v.prompt_id)
                throw new Error('ComfyUI 未返回 prompt_id，请检查工作流和节点');
            const done = await t.poll(t.url('/history/' + encodeURIComponent(v.prompt_id)), x => { const h = x[v.prompt_id]; return { done: h?.status?.completed === true, fail: h?.status?.status_str === 'error', result: h }; });
            const nodes = options.outputNodes ? options.outputNodes.map(k => done.outputs?.[k]) : Object.values(done.outputs ?? {});
            const images = nodes.flatMap((node) => node?.images ?? []).filter((im) => im.type !== 'temp');
            return Promise.all(images.slice(0, s.maxImages).map(async (im) => {
                const query = new URLSearchParams({ filename: im.filename, subfolder: im.subfolder || '', type: im.type || 'output' });
                return bytesOf(await t.request(t.url('/view?' + query)), s.maxMB * 1024 * 1024, t.signal);
            }));
        }
        case 'custom': {
            const vars = { prompt, negativePrompt: r.negativePrompt || '', width, height, size, model: s.model, apiKey: s.apiKey, seed: Math.floor(Math.random() * 2 ** 32) };
            let payload = imageTemplate(options.body ?? { model: '{{model}}', prompt: '{{prompt}}' }, vars);
            if (options.multipart) {
                const form = new FormData();
                for (const [key, value] of Object.entries(payload))
                    form.set(key, typeof value === 'string' ? value : JSON.stringify(value));
                payload = form;
            }
            const response = await t.request(t.base, payload, imageTemplate(options.headers ?? {}, vars), options.method || 'POST');
            if (options.binary)
                return [await bytesOf(response, s.maxMB * 1024 * 1024, t.signal)];
            let v = JSON.parse((await bytesOf(response, MAX_JSON, t.signal)).toString('utf8'));
            if (options.poll) {
                const p = options.poll;
                const taskId = pathValue(v, p.idPath || 'id');
                if (!taskId && !p.urlPath)
                    throw new Error('自定义接口没有返回任务 ID');
                const target = p.urlPath ? pathValue(v, p.urlPath) : imageTemplate(p.url, { ...vars, taskId: encodeURIComponent(String(taskId)) });
                if (typeof target !== 'string' || !target)
                    throw new Error('自定义接口没有返回任务地址');
                v = await t.poll(target, x => ({ done: (p.success || ['SUCCEEDED', 'succeeded']).includes(pathValue(x, p.statusPath || 'status')), fail: (p.failure || ['FAILED', 'failed', 'canceled']).includes(pathValue(x, p.statusPath || 'status')) }), imageTemplate(options.headers ?? {}, vars));
            }
            return sources(pathValue(v, options.resultPath || 'data'));
        }
        case 'command': return runCommand(s, r, t.signal);
        default: throw new Error('不支持的生图协议');
    }
}
async function runCommand(s, request, signal) {
    const argv = JSON.parse(s.command || '[]');
    if (!Array.isArray(argv) || !argv.length || argv.some(v => typeof v !== 'string') || !isAbsolute(argv[0]))
        throw new Error('本地程序填写 JSON 参数数组，首项必须是程序的绝对路径');
    return new Promise((accept, reject) => {
        const child = spawn(argv[0], argv.slice(1), { shell: false, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, IMAGE_GENERATION_API_KEY: s.apiKey } });
        const chunks = [];
        let length = 0, oversized = false;
        child.stdout.on('data', (chunk) => { length += chunk.length; if (length > MAX_JSON) {
            oversized = true;
            child.kill('SIGKILL');
        }
        else
            chunks.push(chunk); });
        child.stderr.resume(); // Never put script output / secrets in logs.
        child.stdin.on('error', () => { });
        let killTimer;
        const terminate = (sig) => {
            try {
                if (child.pid && process.platform !== 'win32')
                    process.kill(-child.pid, sig);
                else
                    child.kill(sig);
            }
            catch { /* already exited */ }
        };
        const abort = () => { terminate('SIGTERM'); killTimer = setTimeout(() => terminate('SIGKILL'), 500); };
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted)
            abort();
        child.on('error', reject);
        child.on('close', code => {
            signal.removeEventListener('abort', abort);
            if (killTimer)
                clearTimeout(killTimer);
            if (signal.aborted)
                return reject(signal.reason);
            if (oversized || code !== 0)
                return reject(new Error('本地生图程序失败（退出码 ' + code + '）'));
            try {
                accept(sources(JSON.parse(Buffer.concat(chunks).toString('utf8')).images));
            }
            catch {
                reject(new Error('本地程序须在 stdout 输出 JSON：{"images":["base64或HTTP图片地址"]}'));
            }
        });
        child.stdin.end(JSON.stringify({ ...request, model: s.model, options: imageOptions(s.options) }));
    });
}
export class ImageGenerator {
    dir;
    settings;
    active = new Set();
    constructor(dir, settings) {
        this.dir = dir;
        this.settings = settings;
    }
    dispose() { for (const c of this.active)
        c.abort(new Error('插件已停止')); }
    async run(request, signal) {
        const s = { ...this.settings() };
        if (!s.enabled)
            throw new Error('图片生成未开启');
        if (!(s.provider in IMAGE_PROVIDERS))
            throw new Error('未知生图协议');
        if (!request.prompt?.trim() || request.prompt.length > 12000)
            throw new Error('提示词须为 1–12000 字符');
        if (request.size && !/^\d{2,4}x\d{2,4}$/.test(request.size))
            throw new Error('图片尺寸格式为 宽x高，例如 1024x1024');
        const count = request.count ?? 1;
        if (!Number.isSafeInteger(count) || count < 1 || count > s.maxImages)
            throw new Error('请求图片数量超出上限');
        if (this.active.size >= 2)
            throw new Error('已有两个生图任务运行，请稍后再试');
        if (s.provider !== 'command')
            httpUrl(s.baseUrl);
        const controller = new AbortController();
        const combined = AbortSignal.any([controller.signal, AbortSignal.timeout(s.timeoutSeconds * 1000), ...(signal ? [signal] : [])]);
        this.active.add(controller);
        const result = { images: [] };
        try {
            const t = new Transport(s, combined), options = imageOptions(s.options);
            mkdirSync(this.dir, { recursive: true, mode: 0o700 });
            for (let i = 0; i < count; i++) {
                const output = await generate(t, request, options);
                if (!output.length)
                    throw new Error('接口未返回图片，可能被内容规则拒绝或响应格式不匹配');
                for (const source of output.slice(0, count - result.images.length)) {
                    const bytes = typeof source === 'string' ? await t.image(source) : source;
                    const type = sniffImage(bytes);
                    if (!type || bytes.length > s.maxMB * 1024 * 1024)
                        throw new Error('生成结果不是受支持的图片，或超过大小上限');
                    combined.throwIfAborted();
                    const id = randomUUID() + '.' + ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }[type]);
                    const path = join(this.dir, id);
                    writeFileSync(path, bytes, { mode: 0o600, flag: 'wx' });
                    result.images.push({ id, mediaType: type, bytes: bytes.length, createdAt: Date.now(), path });
                }
                if (result.images.length >= count)
                    break;
            }
            this.prune(s.keepDays);
            return result;
        }
        catch (e) {
            if (combined.aborted)
                throw new Error('生图已取消或超时；远端已提交任务可能仍计费，请勿盲目重复提交');
            if (!result.images.length)
                throw new Error(safeProviderError(e, s.apiKey));
            result.warning = safeProviderError(e, s.apiKey);
            return result;
        }
        finally {
            this.active.delete(controller);
        }
    }
    file(id) {
        if (!/^[a-f0-9-]{36}\.(png|jpg|webp|gif)$/.test(id))
            return undefined;
        const path = join(this.dir, id);
        try {
            if (statSync(path).isFile())
                return path;
        }
        catch { /* missing */ }
        return undefined;
    }
    list() {
        try {
            return readdirSync(this.dir).flatMap(id => {
                const path = this.file(id);
                if (!path)
                    return [];
                const st = statSync(path);
                return [{ id, bytes: st.size, createdAt: st.mtimeMs, mediaType: 'image/' + (id.endsWith('.jpg') ? 'jpeg' : id.split('.').pop()) }];
            }).sort((a, b) => b.createdAt - a.createdAt);
        }
        catch {
            return [];
        }
    }
    prune(days) {
        const cutoff = Date.now() - days * 86400000;
        for (const [i, f] of this.list().entries())
            if (i >= 100 || f.createdAt < cutoff)
                rmSync(join(this.dir, f.id), { force: true });
    }
}
