import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, utimesSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ImageGenerator, imageTemplate, safeProviderError } from '../lib/image-generation.js'
import { imageTool } from '../lib/companion/image-tool.js'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')
const b64 = png.toString('base64')
const defaults = { enabled: true, provider: 'openai', baseUrl: '', apiKey: 'fixture-key', model: 'fixture-model', options: '{}', command: '', timeoutSeconds: 20, maxImages: 4, maxMB: 1, keepDays: 7 }
async function mock(handler, run) {
  const server = createServer((req, res) => {
    const buffers = []
    req.on('data', b => buffers.push(b))
    req.on('end', () => {
      const body = Buffer.concat(buffers).toString()
      const json = value => res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(value))
      Promise.resolve(handler(req, res, body, json)).catch(e => { res.writeHead(500).end(); throw e })
    })
  })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  const base = 'http://127.0.0.1:' + server.address().port
  const dir = mkdtempSync(join(tmpdir(), 'companion-image-'))
  try { await run(base, dir) } finally { server.closeAllConnections(); await new Promise(r => server.close(r)); rmSync(dir, { recursive: true, force: true }) }
}

test('native image protocol requests and normalized results', async t => {
  const providers = ['openai', 'azure', 'modelscope', 'dashscope', 'gemini', 'imagen', 'vertex', 'openrouter', 'bfl', 'fal', 'replicate', 'stability', 'ideogram', 'huggingface', 'a1111', 'comfyui', 'custom']
  await Promise.all(providers.map(provider => t.test(provider, async () => {
    let submissions = 0, polls = 0
    await mock((req, res, raw, json) => {
      const origin = 'http://' + req.headers.host
      if (req.url === '/result.png') {
        assert.equal(req.headers.authorization, undefined, 'image download must not carry credentials')
        return res.writeHead(200, { 'content-type': 'image/png' }).end(png)
      }
      if (req.method === 'GET') {
        polls++
        if (provider === 'comfyui' && req.url.startsWith('/view?')) return res.writeHead(200).end(png)
        return json({ task_status: 'SUCCEED', output_images: [origin + '/result.png'], output: { task_status: 'SUCCEEDED', choices: [{ message: { content: [{ image: origin + '/result.png' }] } }] }, status: provider === 'bfl' ? 'Ready' : provider === 'fal' ? 'COMPLETED' : 'succeeded', result: { sample: origin + '/result.png' }, images: [{ url: origin + '/result.png' }], 'comfy-task': { status: { completed: true }, outputs: { '9': { images: [{ filename: 'a.png', type: 'output' }] } } } })
      }
      submissions++
      if (['stability', 'ideogram'].includes(provider)) {
        assert.match(req.headers['content-type'], /multipart\/form-data/)
        assert.match(raw, /a cat/)
        if (provider === 'stability') return res.writeHead(200).end(png)
        assert.equal(req.headers['api-key'], 'fixture-key')
        return json({ data: [{ url: origin + '/result.png' }] })
      }
      const body = JSON.parse(raw)
      if (provider === 'openai') { assert.equal(req.url, '/images/generations'); assert.equal(body.n, 1); return json({ data: [{ b64_json: b64 }] }) }
      if (provider === 'azure') { assert.equal(req.url, '/deployment?api-version=test'); assert.equal(req.headers['api-key'], 'fixture-key'); assert.equal(req.headers.authorization, undefined); return json({ data: [{ b64_json: b64 }] }) }
      if (provider === 'modelscope') { assert.equal(req.headers['x-modelscope-async-mode'], 'true'); return json({ task_id: 'task-1' }) }
      if (provider === 'dashscope') { assert.equal(body.input.messages[0].content[0].text, 'a cat'); assert.equal(body.parameters.size, '1024*1024'); return json({ output: { task_id: 'task-1' } }) }
      if (provider === 'gemini') { assert.equal(req.headers['x-goog-api-key'], 'fixture-key'); assert.equal(req.headers.authorization, undefined); return json({ candidates: [{ content: { parts: [{ text: 'done' }, { inlineData: { data: b64, mimeType: 'image/png' } }] } }] }) }
      if (['imagen', 'vertex'].includes(provider)) { assert.equal(body.instances[0].prompt, 'a cat'); return json({ predictions: [{ bytesBase64Encoded: b64 }] }) }
      if (provider === 'openrouter') { assert.deepEqual(body.modalities, ['image', 'text']); return json({ choices: [{ message: { images: [{ image_url: { url: 'data:image/png;base64,' + b64 } }] } }] }) }
      if (provider === 'bfl') { assert.equal(req.headers['x-key'], 'fixture-key'); return json({ polling_url: origin + '/poll' }) }
      if (provider === 'fal') { assert.equal(req.headers.authorization, 'Key fixture-key'); return json({ status_url: origin + '/poll', response_url: origin + '/result' }) }
      if (provider === 'replicate') { assert.equal(body.input.prompt, 'a cat'); return json({ status: 'succeeded', output: [origin + '/result.png'] }) }
      if (provider === 'huggingface') { assert.equal(body.inputs, 'a cat'); return res.writeHead(200).end(png) }
      if (provider === 'a1111') { assert.equal(body.batch_size, 1); return json({ images: [b64] }) }
      if (provider === 'comfyui') { assert.equal(body.prompt['1'].inputs.text, 'a cat'); return json({ prompt_id: 'comfy-task' }) }
      assert.equal(body.description, 'a cat'); assert.equal(body.width, 1024); return json({ pictures: [{ b64_json: b64 }] })
    }, async (base, dir) => {
      const settings = { ...defaults, provider, baseUrl: ['azure', 'vertex'].includes(provider) ? base + '/deployment?api-version=test' : base }
      if (provider === 'comfyui') settings.options = JSON.stringify({ workflow: { '1': { inputs: { text: '{{prompt}}' } } } })
      if (provider === 'custom') settings.options = JSON.stringify({ body: { description: '{{prompt}}', width: '{{width}}' }, resultPath: 'pictures' })
      const generator = new ImageGenerator(dir, () => settings)
      const result = await generator.run({ prompt: 'a cat' })
      assert.equal(result.images.length, 1)
      assert.deepEqual(readFileSync(result.images[0].path), png)
      assert.equal(generator.list().length, 1)
      assert.equal(generator.file('../secret'), undefined)
      assert.equal(submissions, 1)
      if (['modelscope', 'dashscope', 'bfl', 'fal', 'comfyui'].includes(provider)) assert.ok(polls > 0)
    })
  })))
})

test('custom asynchronous template and typed fields', async () => {
  await mock((req, _res, body, json) => {
    if (req.method === 'POST') { assert.equal(JSON.parse(body).w, 768); return json({ task: { id: 'job/1' } }) }
    assert.equal(req.url, '/jobs/job%2F1')
    json({ state: 'done', payload: { images: [b64] } })
  }, async (base, dir) => {
    const settings = { ...defaults, provider: 'custom', baseUrl: base, options: JSON.stringify({ body: { text: '{{prompt}}', w: '{{width}}' }, poll: { url: base + '/jobs/{{taskId}}', idPath: 'task.id', statusPath: 'state', success: ['done'] }, resultPath: 'payload.images' }) }
    assert.equal((await new ImageGenerator(dir, () => settings).run({ prompt: 'cat', size: '768x768' })).images.length, 1)
  })
  assert.deepEqual(imageTemplate({ a: '{{width}}', b: 'x{{prompt}}' }, { width: 512, prompt: '"$()' }), { a: 512, b: 'x"$()' })
})

test('errors, limits, partial generation, retention and credential boundaries', async () => {
  let count = 0
  await mock((req, res, _body, json) => {
    count++
    if (req.url === '/limited') return res.writeHead(429).end('fixture-key')
    if (req.url === '/cross/images/generations') return json({ task_id: 'x' })
    if (req.url === '/partial/images/generations' && count > 1) return res.writeHead(500).end('error')
    if (req.url === '/bad/images/generations') return json({ data: [{ b64_json: Buffer.from('not an image').toString('base64') }] })
    return json({ data: [{ b64_json: b64 }] })
  }, async (base, dir) => {
    let settings = { ...defaults, provider: 'azure', baseUrl: base + '/limited' }
    const generator = new ImageGenerator(dir, () => settings)
    await assert.rejects(generator.run({ prompt: 'cat' }), /429/); assert.equal(count, 1)
    settings = { ...defaults, baseUrl: base + '/partial' }; count = 0
    const partial = await generator.run({ prompt: 'cat', count: 3 })
    assert.equal(partial.images.length, 1); assert.match(partial.warning, /500/); assert.equal(count, 2)
    const old = partial.images[0].path; utimesSync(old, new Date(0), new Date(0))
    settings = { ...defaults, baseUrl: base }
    await generator.run({ prompt: 'new' }); assert.equal(existsSync(old), false)
    settings = { ...settings, baseUrl: base + '/bad' }
    await assert.rejects(generator.run({ prompt: 'cat' }), /不是受支持/)
    settings = { ...settings, enabled: false }
    await assert.rejects(generator.run({ prompt: 'cat' }), /未开启/)
    assert.equal(safeProviderError(new Error('fixture-key https://example.com/a?token=hidden'), 'fixture-key'), '[redacted] [remote URL]')
  })
  await mock((_req, _res, _body, json) => json({ polling_url: 'http://example.com/stolen' }), async (base, dir) => {
    await assert.rejects(new ImageGenerator(dir, () => ({ ...defaults, provider: 'bfl', baseUrl: base })).run({ prompt: 'cat' }), /跨域/)
  })
})

test('local program stdin has literal prompts; cancellation kills an uncooperative process', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'companion-image-command-'))
  try {
    const script = join(dir, 'runner.mjs'), marker = join(dir, 'alive')
    writeFileSync(script, `let input='';process.stdin.on('data',b=>input+=b);process.stdin.on('end',()=>{const r=JSON.parse(input);if(r.prompt!=='$(touch secret)')process.exit(2);process.stdout.write(JSON.stringify({images:[${JSON.stringify(b64)}]}));});`)
    const settings = { ...defaults, provider: 'command', command: JSON.stringify([process.execPath, script]) }
    const generator = new ImageGenerator(join(dir, 'out'), () => settings)
    assert.equal((await generator.run({ prompt: '$(touch secret)' })).images.length, 1)
    writeFileSync(script, `import{writeFileSync}from'node:fs';process.on('SIGTERM',()=>{});writeFileSync(${JSON.stringify(marker)},String(process.pid));setInterval(()=>{},100);`)
    const abort = new AbortController(), task = generator.run({ prompt: 'hang' }, abort.signal)
    const end = Date.now() + 5000
    while (!existsSync(marker) && Date.now() < end) await new Promise(r => setTimeout(r, 20))
    assert.ok(existsSync(marker))
    abort.abort()
    await assert.rejects(task, /取消或超时/)
    assert.throws(() => process.kill(Number(readFileSync(marker, 'utf8')), 0), /ESRCH/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('tool rechecks live permissions and uses web attachments or current QQ delivery', async () => {
  let allowed = false, generated = 0, delivered = 0, attached = 0, qq = false, revoke = false
  const tool = imageTool({ generator: { run: async () => { generated++; if (revoke) allowed = false; return { images: [{ id: 'i' }] } } }, allowed: () => allowed,
    deliver: async () => { delivered++; return qq }, attach: async () => { attached++; return { attachmentId: 'a', bytes: 1, mediaType: 'image/png' } } })
  const exec = { agent: { session: { id: 'test' } }, signal: new AbortController().signal }
  assert.equal((await tool.execute({ prompt: 'cat' }, exec)).ok, false); assert.equal(generated, 0)
  allowed = true
  const web = await tool.execute({ prompt: 'cat' }, exec); assert.equal(web.images.length, 1); assert.equal(attached, 1)
  assert.equal(tool.output.render({}, web)[1].type, 'image')
  qq = true
  const result = await tool.execute({ prompt: 'cat' }, exec); assert.equal(result.images.length, 0); assert.match(result.message, /已发送/)
  revoke = true
  assert.equal((await tool.execute({ prompt: 'cat' }, exec)).ok, false); assert.equal(delivered, 2)
})

test('custom multipart/binary response, download limit and cancellation/concurrency', async () => {
  await mock((req, res, raw, json) => {
    if (req.url === '/multipart') { assert.match(req.headers['content-type'], /multipart/); assert.match(raw, /cat/); return res.writeHead(200).end(png) }
    if (req.url === '/large/images/generations') return json({ data: [{ url: 'http://' + req.headers.host + '/large-image' }] })
    if (req.url === '/large-image') return res.writeHead(200, { 'content-length': 2 * 1024 * 1024 }).end(Buffer.alloc(2 * 1024 * 1024))
    if (req.method === 'POST') return json({ task_id: 'pending' })
    return json({ task_status: 'RUNNING' })
  }, async (base, dir) => {
    let settings = { ...defaults, provider: 'custom', baseUrl: base + '/multipart', options: JSON.stringify({ multipart: true, binary: true, body: { prompt: '{{prompt}}' } }) }
    const generator = new ImageGenerator(dir, () => settings)
    assert.equal((await generator.run({ prompt: 'cat' })).images.length, 1)
    settings = { ...defaults, baseUrl: base + '/large' }
    await assert.rejects(generator.run({ prompt: 'cat' }), /大小上限/)
    settings = { ...defaults, provider: 'modelscope', baseUrl: base }
    const first = new AbortController(), second = new AbortController()
    const outcomes = [generator.run({ prompt: 'a' }, first.signal), generator.run({ prompt: 'b' }, second.signal)].map(p => p.then(() => 'unexpected', e => e.message))
    await assert.rejects(generator.run({ prompt: 'third' }), /两个生图任务/)
    first.abort();second.abort()
    assert.ok((await Promise.all(outcomes)).every(m => /取消或超时/.test(m)))
  })
})
