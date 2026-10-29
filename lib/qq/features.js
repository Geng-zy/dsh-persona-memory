import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { countRounds, pendingHumanTurn } from './rounds.js';
import { QqRetention } from './retention.js';
import { join, dirname } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, statSync, createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import { ImageGenerator, IMAGE_PROVIDERS, imageOptions } from '../image-generation.js';
import { imageTool } from './image-tool.js';
import { make } from '../components.js';
import { qqFeatureSchema } from './config.js';
import { Archive, SCHEMA_VERSION } from './archive.js';
import { defaultDataDir, writeAtomic } from './docs.js';
import { archiveAllowed, matchRule, scopeOf } from './rules.js';
import { archivedImage } from './archived-image.js';
import { localClock, logicalDay } from './clock.js';
import { Proactive } from './proactive.js';
import { applyPendingImport, cleanItems, configuredItems, createBackup, inspectBackup, ITEMS, itemsOf, listBackups, readSavedSettings, safeBackupName, restoreContents, SETTINGS_ITEMS } from './backup.js';
const errText = (e) => e instanceof Error ? e.message : String(e);
export async function applyQqFeatures(ctx, get, log, localBridge) {
    const logs = [];
    const writer = log;
    log = (level, message) => { logs.push({ time: Date.now(), level, message }); if (logs.length > 200)
        logs.shift(); writer(level, message); };
    const dir = defaultDataDir();
    const sessionServices = () => ({ bridge: localBridge, persistence: ctx.get('sessionPersistence'), attachments: ctx.get('attachments'), workspaces: ctx.get('workspaceRegistry') });
    let lastImport;
    try {
        const imported = await applyPendingImport(dir, () => 5, sessionServices());
        if (imported)
            lastImport = { manifest: imported.manifest, plan: imported.plan, at: Date.now() };
    }
    catch (e) {
        lastImport = { manifest: undefined, at: Date.now(), error: errText(e) };
        log('error', 'QQ导入未完成：' + errText(e));
    }
    const archive = new Archive(join(dir, 'companion.db'));
    const snowluma = () => localBridge;
    const scope = (id) => scopeOf(id, snowluma());
    const rules = () => get('qqRules') ?? [];
    const archivePolicy = (s) => { const r = matchRule(s, rules()); return { days: r?.archiveDays ?? (s.category === 'master' ? get('archiveDaysMaster') : get('archiveDaysOthers')), unwoken: r?.archiveUnwoken === 'on' ? true : r?.archiveUnwoken === 'off' ? false : s.category === 'group' ? get('archiveUnwoken') : true }; };
    const organizer = {
        categoryOf(umo, kind) { const info = snowluma()?.sessionInfoByUmo(umo); return kind === 'group' ? 'group' : info?.adminPrivate ? 'master' : archive.cursor('cat:' + umo) === 1 ? 'master' : 'private'; },
        rememberCategory(umo, category) { archive.setCursor('cat:' + umo, category === 'master' ? 1 : category === 'group' ? 3 : 2); },
        onReply(_umo, _rounds) { },
    };
    const meta = { get: (key) => archive.db.prepare('SELECT value FROM meta WHERE key=?').get(key)?.value, set: (key, value) => { archive.db.prepare('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value); } };
    const mediaDir = join(dir, 'media');
    const retention = new QqRetention({ archive, organizer: { categoryOf: organizer.categoryOf, organizeUmo: async (umo, reason) => ctx.get('companion')?.organizeConversation?.(umo, reason) },
        settings: () => ({ rotateSessions: get('rotateSessions'), deleteOldSessions: get('deleteOldSessions'), carryMessages: get('carryMessages'), archiveDays: s => archivePolicy(s).days }),
        snowluma, registry: () => ctx.get('workspaceRegistry'), persistence: () => ctx.get('sessionPersistence'),
        isRunning: id => ctx.get('agents').list().some(a => String(a.session?.id) === id && a.status === 'running'),
        isLive: id => ctx.get('agents').list().some(a => String(a.session?.id) === id), sessionsRoot: join(dirname(dir), 'sessions'), mediaDir,
        setCarry: (umo, text) => meta.set('carry:' + umo, text), log });
    ctx.effect(() => { let busy = false; const timer = setInterval(() => { const day = logicalDay(Date.now(), 0, get('timezone')); if (busy || meta.get('retention:day') === day)
        return; busy = true; void retention.run().then(() => meta.set('retention:day', day)).catch(e => log('warn', 'QQ到期处理失败：' + errText(e))).finally(() => { busy = false; }); }, 60000); return () => clearInterval(timer); }, 'qq: retention');
    ctx.on('agent/pre-step', (async (payload, next) => {
        const decision = await next(), agent = payload.agent;
        if (!agent || decision?.kind !== 'enter')
            return decision;
        const id = String(agent.session.id), s = scope(id);
        if (!s.qq || !s.umo || countRounds(agent.session) !== 0 || !pendingHumanTurn(agent.session))
            return decision;
        const persona = ctx.get('companion');
        if (persona?.contextPolicy?.(id, agent.session.meta?.agentPreset))
            return decision;
        const key = 'carry:' + s.umo, text = meta.get(key);
        if (!text)
            return decision;
        archive.db.prepare('DELETE FROM meta WHERE key=?').run(key);
        return { ...decision, messages: [createUserMessage({ source: { kind: 'plugin:snowluma-bridge' }, content: [{ type: 'text', text: '<previous_session>\n' + text + '\n</previous_session>' }] }), ...decision.messages] };
    }));
    ctx.provide('qqArchive', { archive, mediaDir, categoryOf: organizer.categoryOf, policy: archivePolicy, takeCarry: (umo) => { const key = 'carry:' + umo, value = meta.get(key) ?? ''; archive.db.prepare('DELETE FROM meta WHERE key=?').run(key); return value; } });
    const imageGenerator = new ImageGenerator(join(dir, 'generated-images'), () => ({
        enabled: get('imageGenEnabled'), provider: get('imageGenProvider'), baseUrl: get('imageGenApiUrl'),
        apiKey: get('imageGenApiKey') ?? '', model: get('imageGenModel'), options: get('imageGenOptions'), command: get('imageGenCommand'),
        timeoutSeconds: get('imageGenTimeoutSeconds'), maxImages: get('imageGenMaxImages'), maxMB: get('imageGenMaxMB'), keepDays: get('imageGenKeepDays'),
    }));
    ctx.effect(() => () => imageGenerator.dispose(), 'companion: image generation');
    const clockOk = (v, fallback) => /^\d{1,2}:\d{2}$/.test(v.trim()) ? v.trim().padStart(5, '0') : fallback;
    const proactive = archive !== undefined
        ? new Proactive({
            archive, organizer, mediaDir, meta, log,
            allowed: umo => {
                const [platform_name, message_type, session_id, ...extra] = umo.split(':');
                return extra.length === 0 && (message_type === 'GroupMessage' || message_type === 'FriendMessage')
                    && archiveAllowed(snowluma(), { platform_name, message_type, session_id });
            },
            wake: () => snowluma()?.wake?.bind(snowluma()),
            settings: () => ({
                enabled: get('proactiveEnabled'), masterMinMinutes: get('proactiveMinMinutes'), masterMaxMinutes: get('proactiveMaxMinutes'),
                othersMinMinutes: get('proactiveOthersMinMinutes'), othersMaxMinutes: get('proactiveOthersMaxMinutes'), privateEnabled: get('proactivePrivate'), groupEnabled: get('proactiveGroup'),
                quietStart: clockOk(get('quietStart'), '01:00'), quietEnd: clockOk(get('quietEnd'), '09:00'), recentMinutes: get('proactiveRecentMinutes'),
                groupContextMessages: get('proactiveGroupContext'), activeWithinDays: get('proactiveActiveDays'),
                silenceToken: snowluma()?.silenceToken?.() ?? (get('silenceToken') || '[不发]'), timeZone: get('timezone'),
                override: s => {
                    const row = matchRule(s, rules());
                    return row?.proactive === 'on' ? true : row?.proactive === 'off' ? false : undefined;
                },
            }),
        })
        : undefined;
    ctx.effect(() => {
        let running = false;
        const timer = setInterval(() => {
            if (proactive === undefined || running)
                return;
            running = true;
            void proactive.tick().catch(e => log('warn', '主动聊天出错：' + errText(e))).finally(() => { running = false; });
        }, 60_000);
        return () => clearInterval(timer);
    }, 'companion: proactive');
    ctx.on('snowluma/prompt', (async (payload) => {
        try {
            const info = payload.info;
            if (archive === undefined || info?.type !== 'group' || get('groupContextCount') <= 0)
                return;
            const s = { category: 'group', qq: true, umo: info.umo, ...(info.groupId ? { groupId: info.groupId } : {}) };
            if (!archivePolicy(s).unwoken)
                return;
            const umo = String(info.umo);
            const rows = archive.lastMessages(umo, get('groupContextCount'), payload.message?.message_id !== undefined ? String(payload.message.message_id) : undefined);
            if (rows.length === 0)
                return;
            const media = snowluma()?.media;
            const lines = [];
            const images = [];
            for (const r of rows) {
                let extra = '';
                if (r.segments) {
                    try {
                        const all = JSON.parse(r.segments);
                        // 收到时已经下载存好的图片直接用（QQ 链接可能已经过期）
                        const local = Array.isArray(all) ? all.filter((c) => c?.type === 'Image' && typeof c._local === 'string') : [];
                        for (const c of local) {
                            const image = archivedImage(mediaDir, c._local);
                            if (!image)
                                continue;
                            images.push(image);
                            extra += ' [图片，见下面]';
                        }
                        const comps = Array.isArray(all) ? all.filter((c) => !(c?.type === 'Image' && typeof c._local === 'string')) : [];
                        if (media?.convert === undefined)
                            throw new Error('没有 dsh-snowluma-bridge 的媒体服务');
                        if (Array.isArray(comps) && comps.some((c) => c?.type === 'Image' || c?.type === 'Record' || c?.type === 'Video')) {
                            const got = await media.convert(comps, Infinity);
                            const imgCount = got.parts.filter((p) => p?.type === 'image').length;
                            if (imgCount > 0)
                                extra += ' [图片×' + imgCount + '，见下面]';
                            if (got.text)
                                extra += ' ' + got.text;
                            images.push(...got.parts);
                        }
                    }
                    catch (e) {
                        log('debug', '群消息里的图片/语音没转出来：' + errText(e));
                    }
                }
                lines.push('[' + (r.direction === 'out' ? '我' : (r.senderName || r.senderId) + '(' + r.senderId + ')') + '] ' + ((r.text || '').trim() || (extra ? '' : '[图片/语音等]')) + extra);
            }
            const head = { type: 'text', text: '<group_context>\n在这条消息之前，群里最近的消息（按时间顺序，[我] 是你自己说的）：\n' + lines.join('\n') + '\n</group_context>' };
            const tail = images.length > 0 ? [{ type: 'text', text: '（下面是上面那些群消息里的图片）' }, ...images] : [];
            payload.content.unshift(head, ...tail);
        }
        catch (e) {
            log('warn', '附带群聊之前的消息时出错：' + errText(e));
        }
    }));
    const imageAllowed = (sessionId) => {
        if (!get('imageGenEnabled'))
            return false;
        const s = scope(sessionId);
        if (s.category === 'private' && !get('imageGenPrivate') || s.category === 'group' && !get('imageGenGroup'))
            return false;
        return !s.qq || snowluma()?.canSendToolResult?.(sessionId) === true;
    };
    const imageDefinition = imageTool({ generator: imageGenerator, allowed: imageAllowed,
        deliver: async (sessionId, images, signal) => {
            if (!scope(sessionId).qq)
                return false;
            signal.throwIfAborted();
            const bridge = snowluma();
            if (!bridge?.sendToolImages || !imageAllowed(sessionId))
                throw new Error('QQ会话已不允许发送');
            // Base64 is portable across host/container boundaries; never expose host file paths to QQ.
            const chain = { chain: images.map(image => make('Image', { file: 'base64://' + readFileSync(image.path).toString('base64') })) };
            await bridge.sendToolImages(sessionId, chain);
            return true;
        },
        attach: async (image) => {
            const attachments = sessionServices().attachments;
            if (!attachments)
                throw new Error('dsh附件服务不可用；图片已生成，可在设置页下载');
            return attachments.saveImage({ data: readFileSync(image.path), mediaType: image.mediaType, name: image.id });
        }, });
    const equipped = new WeakMap();
    const equip = (agent) => {
        if (agent === undefined || equipped.has(agent))
            return;
        const sessionId = String(agent.session?.id ?? '');
        const defs = [imageDefinition];
        if (defs.length === 0)
            return;
        const tools = agent.ctx?.tools;
        if (tools === undefined) {
            log('warn', '会话 ' + sessionId + ' 没有工具服务，装不了工具');
            return;
        }
        const disposers = [];
        for (const def of defs) {
            try {
                const off = tools.register(def);
                if (typeof off === 'function')
                    disposers.push(off);
            }
            catch (e) {
                log('warn', '会话 ' + sessionId + ' 装工具 ' + def.name + ' 失败: ' + errText(e));
            }
        }
        equipped.set(agent, disposers);
        log('debug', '会话 ' + sessionId + ' 装上了工具：' + defs.map(d => d.name).join('、'));
    };
    ctx.on('agent/created', ((payload) => { equip(payload.agent); }));
    // 插件启动（或重新加载）时，给已经在跑的会话补装
    ctx.effect(() => {
        try {
            for (const agent of ctx.get('agents')?.list?.() ?? [])
                equip(agent);
        }
        catch (e) {
            log('debug', '列出已有会话失败: ' + errText(e));
        }
        return () => {
            for (const agent of ctx.get('agents')?.list?.() ?? []) {
                for (const off of equipped.get(agent) ?? []) {
                    try {
                        off();
                    }
                    catch { /* 会话已经结束 */ }
                }
            }
        };
    }, 'companion: tools');
    //#region 消息存档（插件一的事件）
    const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };
    /** 收到的图片下载存好（按内容的 SHA-256 命名），在存档的消息段里记下文件名。 */
    const saveImages = async (umo, messageId, comps, session) => {
        const allowed = () => get('archiveEnabled') && archiveAllowed(snowluma(), session);
        const media = snowluma()?.media;
        if (media?.loadImage === undefined || archive === undefined)
            return;
        let changed = false;
        for (const c of comps) {
            if (!allowed())
                return;
            if (c?.type !== 'Image' || c._local)
                continue;
            try {
                const img = await media.loadImage(c);
                // 本插件新增：下载期间移出名单或关闭存档，不写文件和数据库。
                if (!allowed())
                    return;
                const bytes = Buffer.from(img.data, 'base64');
                if (bytes.length > 10 * 1024 * 1024)
                    continue;
                const name = createHash('sha256').update(bytes).digest('hex') + '.' + (EXT[img.mediaType] ?? 'jpg');
                mkdirSync(mediaDir, { recursive: true });
                const path = join(mediaDir, name);
                if (!existsSync(path))
                    writeAtomic(path, bytes);
                c._local = name;
                changed = true;
            }
            catch (e) {
                log('debug', '图片没下载下来：' + errText(e));
            }
        }
        if (changed && allowed())
            archive.updateSegments(umo, messageId, JSON.stringify(comps));
    };
    const store = (m) => {
        if (archive === undefined || !get('archiveEnabled'))
            return;
        try {
            archive.add(m);
        }
        catch (e) {
            log('warn', '存档失败: ' + errText(e));
        }
    };
    ctx.on('snowluma/message', ((abm, event, isWake) => {
        const umo = String(event?.unified_msg_origin ?? '');
        if (umo === '' || !archiveAllowed(snowluma(), event?.session))
            return;
        const isGroup = abm?.type === 'GroupMessage';
        const info = snowluma()?.sessionInfoByUmo?.(umo);
        const s = isGroup
            ? { category: 'group', qq: true, groupId: String(abm.raw_message?.group_id ?? abm.group?.group_id ?? abm.session_id ?? '') }
            : { category: info?.adminPrivate ? 'master' : 'private', qq: true, userId: String(abm.session_id ?? abm.sender?.user_id ?? '') };
        if (isGroup || info !== undefined)
            organizer?.rememberCategory(umo, s.category);
        if (isGroup && !isWake && !archivePolicy(s).unwoken)
            return;
        const notice = abm?.raw_message?.post_type !== 'message';
        let segments;
        try {
            segments = JSON.stringify(abm.message ?? []);
        }
        catch {
            segments = undefined;
        }
        store({
            umo, kind: isGroup ? 'group' : 'private',
            ...(isGroup ? { groupId: s.groupId } : { userId: s.userId }),
            ...(abm.message_id !== undefined && abm.message_id !== '' ? { messageId: String(abm.message_id) } : {}),
            time: typeof abm.timestamp === 'number' ? abm.timestamp * 1000 : Date.now(),
            direction: 'in',
            senderId: String(abm.sender?.user_id ?? ''),
            senderName: String(abm.sender?.nickname ?? ''),
            woke: isWake, type: notice ? 'notice' : 'message',
            text: notice ? String(abm.event_text ?? abm.message_str ?? '') : String(abm.message_str ?? ''),
            ...(segments !== undefined && !notice ? { segments } : {}),
            ...(info?.sessionId ? { sessionId: info.sessionId } : {}),
        });
        if (get('archiveImages') && get('archiveEnabled') && !notice && abm.message_id !== undefined && Array.isArray(abm.message) && abm.message.some((c) => c?.type === 'Image')) {
            void saveImages(umo, String(abm.message_id), JSON.parse(segments ?? '[]'), event.session);
        }
    }));
    ctx.on('snowluma/sent', ((p) => {
        // 本插件新增：回复允许管理员在名单外群发言，但该群的出站消息也不存档。
        if (!archiveAllowed(snowluma(), p.session))
            return;
        const isGroup = p.session?.message_type === 'GroupMessage';
        const info = snowluma()?.sessionInfoByUmo?.(p.umo);
        if (info !== undefined)
            organizer?.rememberCategory(p.umo, info.type === 'group' ? 'group' : info.adminPrivate ? 'master' : 'private');
        store({
            umo: p.umo, kind: isGroup ? 'group' : 'private',
            ...(isGroup ? { groupId: p.session.session_id } : { userId: p.session.session_id }),
            time: p.time ?? Date.now(), direction: 'out',
            senderId: String(info?.selfId ?? 'self'), senderName: '她',
            woke: true, type: 'message', text: String(p.text ?? ''),
            ...(info?.sessionId ? { sessionId: info.sessionId } : {}),
        });
        // 每 N 轮整理一次（只算她一轮说完的回复）
    }));
    //#endregion
    const backupsDir = join(dir, 'backups');
    const pluginVersion = (() => { try {
        return String(JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf-8')).version);
    }
    catch {
        return '?';
    } })();
    /** 不含任何 Key 的设置快照 */
    const settingsSnapshot = () => Object.fromEntries(Object.keys(qqFeatureSchema).filter(k => !/ApiKey$/.test(k)).map(k => [k, get(k)]));
    const settingsService = () => ctx.get('settings');
    /** 认出两个插件的设置（按自己的字段认，不靠 profile 里的 id） */
    const formKind = (f) => {
        const keys = Object.keys(f.value ?? {});
        if (keys.includes('personaMaxChars') && keys.includes('backupItems'))
            return 'companion-core';
        if (keys.includes('ws_reverse_host') || keys.includes('wakeKeywords'))
            return 'snowluma-bridge';
        return 'dsh';
    };
    const captureSettings = () => { const f = settingsService()?.describe({ redactSecrets: true }).find(f => formKind(f) === 'snowluma-bridge'); return f ? { 'snowluma-bridge': { ns: f.ns, user: f.user ?? {} } } : {}; };
    const applySettings = async (saved) => {
        const svc = settingsService(), s = saved['snowluma-bridge'];
        if (!svc || !s)
            return [];
        const f = svc.describe({ redactSecrets: true }).find(f => formKind(f) === 'snowluma-bridge');
        if (!f)
            return [];
        const secret = new Set((f.secrets ?? []).map(x => x.path[0]));
        const ops = Object.keys(f.value ?? {}).filter(k => !secret.has(k)).flatMap(k => Object.hasOwn(s.user, k) ? [{ op: 'set', path: [k], value: s.user[k] }] : Object.hasOwn(f.user ?? {}, k) ? [{ op: 'unset', path: [k] }] : []);
        if (ops.length)
            await svc.mutate(f.ns, ops);
        return ['QQ插件设置已恢复；密钥保持原值'];
    };
    const backupNow = async (reason, items) => {
        if (archive === undefined)
            throw new Error('数据库没打开');
        const es = { model: '' };
        const dim = Number(meta.get('embed_dim:' + es.model.trim()) ?? NaN);
        // 导入前的备份什么都带上，万一要退回去
        const chosen = reason === 'before-import' ? ITEMS.filter(i => i !== 'sessionsMaster' || !!(sessionServices().bridge?.masterPrivateBindings && sessionServices().persistence)) : items ?? configuredItems(get('backupItems'));
        const r = await createBackup({
            dataDir: dir, db: archive.db, outDir: backupsDir, reason, plugin: pluginVersion, schema: SCHEMA_VERSION, settings: settingsSnapshot(),
            embed: { ...(es.model.trim() ? { model: es.model.trim() } : {}), ...(Number.isFinite(dim) ? { dim } : {}) }, keep: get('backupKeep'),
            items: chosen, sessionServices: sessionServices(), settingsFiles: chosen.some(i => SETTINGS_ITEMS.includes(i)) ? captureSettings() : {},
        });
        log('info', '备份好了：' + r.name);
        return r;
    };
    ctx.effect(() => {
        const timer = setInterval(() => {
            if (!get('backupEnabled') || archive === undefined)
                return;
            const now = Date.now();
            const day = logicalDay(now, 0, get('timezone'));
            if (meta.get('backup:day') === day || localClock(now, get('timezone')) < clockOk(get('backupTime'), '04:00'))
                return;
            meta.set('backup:day', day);
            void backupNow('auto').catch(e => log('warn', '自动备份失败：' + errText(e)));
        }, 60_000);
        return () => clearInterval(timer);
    }, 'companion: backup');
    let pendingInspect;
    const readBody = (req) => new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', (c) => {
            size += c.length;
            if (size > 4 * 1024 * 1024) {
                reject(new Error('内容太大'));
                req.destroy();
            }
            else
                chunks.push(c);
        });
        req.on('end', () => { try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}'));
        }
        catch (e) {
            reject(e);
        } });
        req.on('error', reject);
    });
    const state = () => ({ dataDir: dir, snowluma: true, docs: {}, archive: archive.stats(), retired: archive.retiredList(), maintenance: retention.last ?? null, proactive: { list: proactive?.list() ?? [], wakeAvailable: true }, backups: listBackups(backupsDir), backupRetention: { keep: get('backupKeep'), scope: 'all' }, backupItemsAll: ITEMS, lastImport, importing: pendingInspect ? { id: pendingInspect.id, manifest: pendingInspect.manifest, items: itemsOf(pendingInspect.manifest), contents: restoreContents(pendingInspect.manifest) } : null, logs });
    ctx.on('connection/request', (async (req, res, next) => {
        const path = new URL(req.url ?? '/', 'http://localhost').pathname;
        const at = path.indexOf('/qq-gateway/');
        if (at < 0 || !path.slice(0, at).endsWith('/api'))
            return next();
        const parts = path.slice(at + '/qq-gateway/'.length).split('/').filter(Boolean);
        const json = (code, value) => {
            res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
            res.end(JSON.stringify(value));
        };
        try {
            if (parts[0] === 'images') {
                if (req.method === 'GET' && parts.length === 1)
                    return json(200, { providers: IMAGE_PROVIDERS, images: imageGenerator.list(), activeTasks: imageGenerator.activeCount });
                if (req.method === 'GET' && parts.length === 2) {
                    const file = imageGenerator.file(parts[1]);
                    if (!file)
                        return json(404, { error: '图片不存在或已清理' });
                    res.writeHead(200, { 'content-type': 'image/' + (file.endsWith('.jpg') ? 'jpeg' : file.split('.').pop()), 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' });
                    createReadStream(file).pipe(res);
                    return;
                }
                if (req.method === 'POST' && parts[1] === 'generate') {
                    if (!String(req.headers['content-type'] ?? '').includes('application/json'))
                        return json(415, { error: '需要 application/json' });
                    const body = await readBody(req);
                    const abort = new AbortController();
                    const onClose = () => { if (!res.writableEnded)
                        abort.abort(); };
                    res.on('close', onClose);
                    try {
                        const result = await imageGenerator.run({ prompt: String(body.prompt ?? ''), ...(body.size ? { size: String(body.size) } : {}), count: Number(body.count ?? 1) }, abort.signal);
                        return json(200, { images: result.images.map(({ path: _path, ...image }) => image), warning: result.warning });
                    }
                    finally {
                        res.off('close', onClose);
                    }
                }
                if (req.method === 'POST' && parts[1] === 'validate') {
                    if (!String(req.headers['content-type'] ?? '').includes('application/json'))
                        return json(415, { error: '需要 application/json' });
                    imageOptions(get('imageGenOptions'));
                    return json(200, { ok: true, message: '高级参数JSON有效；未请求远端、不消耗额度。实际生成仍需验证模型与账号权限。' });
                }
                return json(405, { error: '不支持的图片操作' });
            }
            if (req.method === 'GET' && parts[0] === 'state')
                return json(200, state());
            if (parts[0] === 'maintenance' && req.method === 'POST') {
                if (!String(req.headers['content-type'] ?? '').includes('application/json'))
                    return json(415, { error: '需要application/json' });
                const body = await readBody(req);
                return json(200, { report: await retention.run(process.env.COMPANION_TEST_CLOCK === '1' && typeof body.now === 'number' ? body.now : Date.now()), state: state() });
            }
            // 下载备份：GET /backup/file/<名字>
            if (req.method === 'GET' && parts[0] === 'backup' && parts[1] === 'file' && parts[2] && safeBackupName(parts[2])) {
                const file = join(backupsDir, parts[2]);
                if (!existsSync(file))
                    return json(404, { error: '没有这个备份' });
                res.writeHead(200, { 'content-type': 'application/gzip', 'content-length': String(statSync(file).size), 'content-disposition': 'attachment; filename="' + parts[2] + '"', 'cache-control': 'no-store' });
                await pipeline(createReadStream(file), res);
                return;
            }
            // 上传备份包：POST /backup/upload，原始字节，要带 x-companion-upload: 1（跨站表单带不了这个头）
            if (parts[0] === 'backup' && parts[1] === 'upload') {
                if (req.method !== 'POST' || req.headers['x-companion-upload'] !== '1')
                    return json(400, { error: '上传方式不对' });
                mkdirSync(backupsDir, { recursive: true });
                const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
                const file = join(backupsDir, '.upload-' + id + '.tar.gz');
                let size = 0;
                req.on('data', (c) => { size += c.length; if (size > 2 * 1024 * 1024 * 1024)
                    req.destroy(new Error('文件太大')); });
                try {
                    await pipeline(req, createWriteStream(file));
                    const r = await inspectBackup(file, join(dir, '.import-' + id));
                    if (pendingInspect)
                        rmSync(pendingInspect.dir, { recursive: true, force: true });
                    pendingInspect = { id, dir: r.dir, manifest: r.manifest };
                    return json(200, state());
                }
                finally {
                    rmSync(file, { force: true });
                }
            }
            if (parts[0] === 'proactive' && parts[1] === 'try') {
                if (req.method !== 'POST')
                    return json(405, { error: '只支持 POST' });
                if (!String(req.headers['content-type'] ?? '').includes('application/json'))
                    return json(415, { error: '需要 application/json' });
                const body = await readBody(req);
                const target = proactive?.scopeForUmo(String(body?.umo ?? ''));
                if (proactive === undefined || target === undefined)
                    return json(404, { error: '没有这个会话' });
                const ok = await proactive.fire(String(body.umo), target);
                return ok ? json(200, state()) : json(500, { error: '唤醒失败，看日志' });
            }
            if (parts[0] === 'proactive' && parts[1] === 'tick' && process.env.COMPANION_TEST_CLOCK === '1') {
                const body = await readBody(req);
                const woken = await proactive?.tick(typeof body?.now === 'number' ? body.now : Date.now());
                return json(200, { woken: woken ?? [] });
            }
            if (parts[0] === 'backup') {
                if (req.method !== 'POST')
                    return json(405, { error: '只支持 POST' });
                if (!String(req.headers['content-type'] ?? '').includes('application/json'))
                    return json(415, { error: '需要 application/json' });
                const body = await readBody(req);
                // backup
                if (parts[1] === 'create') {
                    const r = await backupNow('manual', Array.isArray(body?.items) ? cleanItems(body.items) : undefined);
                    return json(200, { name: r.name, manifest: r.manifest, state: state() });
                }
                if (parts[1] === 'delete') {
                    const name = String(body?.name ?? '');
                    if (!safeBackupName(name))
                        return json(400, { error: '名字不对' });
                    rmSync(join(backupsDir, name), { force: true });
                    return json(200, state());
                }
                if (parts[1] === 'restore') {
                    const name = String(body?.name ?? '');
                    if (!safeBackupName(name) || !existsSync(join(backupsDir, name)))
                        return json(404, { error: '没有这个备份' });
                    const id = Date.now().toString(36);
                    const r = await inspectBackup(join(backupsDir, name), join(dir, '.import-' + id));
                    if (pendingInspect)
                        rmSync(pendingInspect.dir, { recursive: true, force: true });
                    pendingInspect = { id, dir: r.dir, manifest: r.manifest };
                    return json(200, state());
                }
                if (parts[1] === 'cancel') {
                    if (pendingInspect)
                        rmSync(pendingInspect.dir, { recursive: true, force: true });
                    pendingInspect = undefined;
                    return json(200, state());
                }
                if (parts[1] === 'confirm') {
                    if (pendingInspect === undefined || pendingInspect.id !== String(body?.id ?? ''))
                        return json(409, { error: '没有等确认的导入，或者已经过期，请重新上传' });
                    // 要还原哪些：没给就是包里全部
                    const items = (Array.isArray(body?.items) ? cleanItems(body.items) : itemsOf(pendingInspect.manifest)).filter(i => itemsOf(pendingInspect.manifest).includes(i));
                    if (items.length === 0)
                        return json(400, { error: '一样都没勾' });
                    // 先自动备份当前全部数据；设置马上套用；文件和数据库放到待导入的位置，插件重新加载时按勾选替换
                    await backupNow('before-import');
                    const notes = await applySettings(readSavedSettings(pendingInspect.dir, items));
                    writeFileSync(join(pendingInspect.dir, 'restore.json'), JSON.stringify({ items, notes }));
                    rmSync(join(dir, '.pending-import'), { recursive: true, force: true });
                    renameSync(pendingInspect.dir, join(dir, '.pending-import'));
                    pendingInspect = undefined;
                    log('info', '确认导入，插件马上重新加载');
                    json(200, { ok: true, restarting: true });
                    setTimeout(() => { void ctx.fiber?.restart?.(); }, 300);
                    return;
                }
                return json(404, { error: 'not found' });
            }
            return json(404, { error: 'not found' });
        }
        catch (e) {
            return json(500, { error: errText(e) });
        }
    }));
    ctx.effect(() => () => archive.close(), 'qq: archive');
}
