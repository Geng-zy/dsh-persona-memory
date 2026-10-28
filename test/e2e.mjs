#!/usr/bin/env node
// 端到端测试：真实的 dsh web 同时加载插件一（dsh-napcat-bridge，在旁边的文件夹）和本插件，
// 假的 DeepSeek 接口回答模型请求，假的 NapCat 作为客户端连插件一。
//
// 检查：人格和核心记忆替换进系统提示词（主人/群聊看到的核心记忆不同，编程助手身份句去掉）；
// 改人格文件后同一个会话下一步就变；主人会话有改人格工具、群里没有；她用工具改人格后文件真的变了并留了历史；
// 群聊超过轮数按轮截断；主人超过轮数用中文回忆压缩；模型报超出上限时截断后重试成功；
// 消息存档（收到、发出、没唤醒的群消息）；设置页接口要登录、改文件要 JSON 请求。
// 阶段 2：召回的记忆放进这一轮的消息；群聊附上最近几条消息；每个会话都有回忆/记住/遗忘工具；
// 手动整理和压缩前整理（假模型回 JSON）；向量索引（假向量接口）；接口里遗忘一条记忆。
// 阶段 3：写日记；群消息图片收到时下载、群聊上下文用下载好的图；模拟过了 6 天：群会话换新、旧会话归档后
// 真的删掉文件夹（dsh 还能正常用）、新会话开头带上个会话的内容；模拟过了 400 天：主人会话换新、旧的只归档不删、
// 新会话开头先读日记。
// 阶段 4：主动聊天（她说话 / 回「[不发]」就不发 / 群里带上下文）；清理和整合、撤销；手动备份、下载、
// 从备份还原（插件自动重新加载）、还原后自检。
//
// 需要：DSH_BIN 指向 dsh；先在两个仓库都 pnpm run build。不联网、不需要真实 API Key。
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

import WebSocket from 'ws'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BRIDGE = process.env.BRIDGE_DIR ?? join(ROOT, '..', 'dsh-napcat-bridge')
const TOKEN = 'e2e-token'
const MASTER = 123450001
const OTHER = 123450002
const BOT = 123450009
const GROUP = 888000001
const WS_PORT = 19000 + Math.floor(Math.random() * 1000)
const deadline = Date.now() + Number(process.env.E2E_TIMEOUT_MS ?? 240_000)

const log = (...a) => console.log('[e2e]', ...a)
let finished = false
const fail = async message => { console.error('[e2e] FAIL: ' + message); await cleanup(); process.exit(1) }

if (!existsSync(join(BRIDGE, 'lib', 'index.js'))) { console.error('[e2e] 找不到插件一：' + BRIDGE + '（先在那里 pnpm run build）'); process.exit(1) }

// ---- 假 DeepSeek（Anthropic Messages 流式）
const requests = []
const extractions = []
const diaryPrompts = []
const proactivePrompts = []
const graphPrompts = []
const reviewPrompts = []
let proactiveSilent = false
let overflowOnce = true
const textOf = content => (typeof content === 'string' ? content : (content ?? []).filter(b => b.type === 'text').map(b => b.text).join('\n'))
const firstText = content => (typeof content === 'string' ? content : (content ?? []).find(b => b.type === 'text')?.text ?? '')
const embedCalls = []
const llm = createServer((req, res) => {
  let body = ''
  req.on('data', c => { body += c })
  req.on('end', () => {
    if (req.method === 'POST' && req.url.endsWith('/v1/embeddings')) {
      // 假向量接口：按字的编码给个 4 维向量
      const { input } = JSON.parse(body)
      embedCalls.push(input.length)
      const vec = t => { const v = [0, 0, 0, 0]; for (const ch of t) v[ch.codePointAt(0) % 4] += 1; return v }
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ data: input.map((t, index) => ({ index, embedding: vec(t) })) }))
      return
    }
    if (req.method !== 'POST' || !req.url.endsWith('/messages')) {
      res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":{"message":"not found"}}')
      return
    }
    const json = JSON.parse(body || '{}')
    const system = Array.isArray(json.system) ? json.system.map(b => b.text).join('\n') : String(json.system ?? '')
    const msgs = json.messages ?? []
    const lastUser = [...msgs].reverse().find(m => m.role === 'user')
    const last = firstText(lastUser?.content)
    const all = msgs.map(m => textOf(m.content)).join('\n')
    const toolResult = Array.isArray(lastUser?.content) && lastUser.content.some(b => b.type === 'tool_result')
    const lastAll = textOf(lastUser?.content)
    const extracting = lastAll.includes('请从中挑出值得你长期记住的事')
    const images = Array.isArray(lastUser?.content) ? lastUser.content.filter(b => b.type === 'image').length : 0
    const entry = { images, system, last, lastAll, all, raw: JSON.stringify(json.messages ?? []), tools: (json.tools ?? []).map(t => t.name), toolResult, extracting }
    if (extracting) extractions.push(lastAll)
    else requests.push(entry)
    const ev = (type, data) => res.write('event: ' + type + '\ndata: ' + JSON.stringify({ type, ...data }) + '\n\n')
    const start = () => {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
      ev('message_start', { message: { id: 'msg_e2e', type: 'message', role: 'assistant', model: json.model ?? 'e2e', content: [], usage: { input_tokens: 10, output_tokens: 0 } } })
    }
    const text = reply => {
      start()
      ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } })
      ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: reply } })
      ev('content_block_stop', { index: 0 })
      ev('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 5 } })
      ev('message_stop', {})
      res.end()
    }
    if (lastAll.includes('请从每条里抽出提到的实体')) {
      graphPrompts.push(lastAll)
      return text(JSON.stringify([...lastAll.matchAll(/^#(\d+) (.*)$/gm)].map(([, id, content]) => ({
        id: Number(id), entities: [],
        relations: content.includes('GR-1') ? [{ src: '主人', rel: '养了', dst: '橘猫' }, { src: '橘猫', rel: '名字是', dst: '咪咪' }]
          : content.includes('GR-2') ? [{ src: '橘猫', rel: '打了', dst: '疫苗' }] : [],
      }))))
    }
    if (lastAll.includes('你是一个审核员')) { reviewPrompts.push(lastAll); return text(lastAll.includes('违规') ? '{"ok": false, "reason": "这是具体的事，应该记进记忆"}' : '{"ok": true, "reason": ""}') }
    if (lastAll.includes('现在暂停聊天')) return text('回忆：我们聊过苹果和香蕉。')
    if (lastAll.includes('<proactive>')) { proactivePrompts.push(lastAll); return text(proactiveSilent ? '[不发]' : '在忙吗？PRO-1') }
    if (lastAll.includes('整理成更精炼的一到两条')) return text('[{"content":"主人养了一只叫咪咪的橘猫 CAT","kind":"fact","importance":0.7}]')
    if (lastAll.includes('给自己写一篇')) { diaryPrompts.push(lastAll); return text('# 今天的日记 DIARY-1\n今天主人和我聊了很多，我很开心。') }
    if (extracting) {
      const tag = lastAll.includes('QQ 群') ? 'ORG-GROUP' : lastAll.includes('和主人的私聊') ? 'ORG-MASTER' : 'ORG-OTHER'
      return text('```json\n[{"content":"整理出来的记忆 ' + tag + '","kind":"fact","importance":0.6}]\n```')
    }
    if (last.includes('超长') && overflowOnce) {
      overflowOnce = false
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'prompt is too long for this model' } }))
      return
    }
    if (toolResult) return text('改好了')
    if (last.includes('违规改人格') && entry.tools.includes('persona_edit')) {
      start()
      ev('content_block_start', { index: 0, content_block: { type: 'tool_use', id: 'toolu_e2e2', name: 'persona_edit', input: {} } })
      ev('content_block_delta', { index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify({ old_text: '', new_text: '主人昨天请我吃了违规火锅。', reason: '想记住' }) } })
      ev('content_block_stop', { index: 0 })
      ev('message_delta', { delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 5 } })
      ev('message_stop', {})
      res.end()
      return
    }
    if (last.includes('改人格') && entry.tools.includes('persona_edit')) {
      start()
      ev('content_block_start', { index: 0, content_block: { type: 'tool_use', id: 'toolu_e2e1', name: 'persona_edit', input: {} } })
      ev('content_block_delta', { index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify({ old_text: '', new_text: '她最喜欢的水果是芒果。', reason: '主人让我记住' }) } })
      ev('content_block_stop', { index: 0 })
      ev('message_delta', { delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 5 } })
      ev('message_stop', {})
      res.end()
      return
    }
    text('回复:' + last.slice(0, 40))
  })
})
await new Promise(r => llm.listen(0, '127.0.0.1', r))
const llmUrl = 'http://127.0.0.1:' + llm.address().port + '/anthropic'
// 图片服务器：给假 NapCat 的图片地址用（1x1 PNG）
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
let imageDownloads = 0
const imgServer = createServer((_req, res) => { imageDownloads++; res.writeHead(200, { 'content-type': 'image/png' }).end(PNG) })
await new Promise(r => imgServer.listen(0, '127.0.0.1', r))
const imgUrl = 'http://127.0.0.1:' + imgServer.address().port + '/a.png'

// ---- 独立的 DSH_HOME，两个插件都作为 profile bundle
const home = mkdtempSync(join(tmpdir(), 'dsh-companion-e2e-'))
const profile = join(home, 'profiles', 'web')
mkdirSync(join(profile, 'node_modules'), { recursive: true })
symlinkSync(ROOT, join(profile, 'node_modules', 'dsh-companion-core'), 'dir')
symlinkSync(BRIDGE, join(profile, 'node_modules', 'dsh-napcat-bridge'), 'dir')
writeFileSync(join(profile, 'package.json'), JSON.stringify({
  name: 'dsh-profile-web', private: true,
  dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'dsh-napcat-bridge', 'dsh-companion-core'] } },
  dependencies: { 'dsh-napcat-bridge': 'link:' + BRIDGE, 'dsh-companion-core': 'link:' + ROOT },
}, null, 2))
const workspace = join(home, 'workspace')
mkdirSync(workspace)
writeFileSync(join(profile, 'cordis.patch.yml'), `- id: napcat-bridge
  config:
    ws_reverse_host: 127.0.0.1
    ws_reverse_port: ${WS_PORT}
    ws_reverse_token: ${TOKEN}
    workspacePath: ${workspace}
    admins: ['${MASTER}']
    whitelistEnabled: true
    groupWhitelist: ['${GROUP}']
    privateWhitelist: ['${OTHER}']
    datetimeReminder: false
    typingCharsPerMinute: 0
    groupMinGapSeconds: 0
    groupMaxPerWindow: 0
- id: agent-preset-registry
  config:
    default: companion
    selectedDefault: companion
- id: companion-core
  config:
    logLevel: debug
    embedApiUrl: ${llmUrl.replace('/anthropic', '')}/v1
    embedApiKey: e2e-embed-key
    embedModel: fake-embed
    masterMaxRounds: 6
    masterDropRounds: 3
    privateMaxRounds: 50
    groupMaxRounds: 3
    groupDropRounds: 2
    graphEnabled: true
`)
const data = join(home, 'companion')
mkdirSync(join(data, 'persona'), { recursive: true })
mkdirSync(join(data, 'core'), { recursive: true })
const personaFile = join(data, 'persona', 'persona.md')
writeFileSync(personaFile, '你是测试用的陪伴角色 PERSONA-V1。{{这里的花括号不是变量}}')
writeFileSync(join(data, 'core', 'master.md'), '- CORE-MASTER：主人爱吃红烧肉')
writeFileSync(join(data, 'core', 'public.md'), '- CORE-PUBLIC：我是一条鱼')

const dsh = spawn(process.env.DSH_BIN ?? 'dsh', ['web', '--host', '127.0.0.1', '--port', process.env.E2E_WEB_PORT ?? '0', '--no-open'], {
  env: { ...process.env, COMPANION_TEST_CLOCK: '1', DSH_HOME: home, DEEPSEEK_API_KEY: 'sk-e2e-fake', DEEPSEEK_BASE_URL: llmUrl, DSH_TELEMETRY_DISABLED: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let dshLog = ''
for (const s of [dsh.stdout, dsh.stderr]) s.on('data', d => { dshLog += d; if (process.env.E2E_VERBOSE) process.stdout.write(d) })
dsh.on('exit', code => { if (!finished) void fail('dsh 提前退出 (' + code + ')\n' + dshLog.slice(-4000)) })

async function cleanup() {
  finished = true
  if (dsh.exitCode === null && dsh.signalCode === null) {
    const exited = new Promise(resolve => dsh.once('exit', resolve))
    try { dsh.kill('SIGTERM') } catch {}
    await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 15_000))])
    if (dsh.exitCode === null && dsh.signalCode === null) try { dsh.kill('SIGKILL') } catch {}
  }
  llm.close()
  imgServer.close()
  if (!process.env.E2E_KEEP) rmSync(home, { recursive: true, force: true })
}

// ---- 假 NapCat
const url = 'ws://127.0.0.1:' + WS_PORT + '/ws'
let ws
while (ws === undefined) {
  if (Date.now() > deadline) await fail('插件一的 WS 一直没起来\n' + dshLog.slice(-4000))
  ws = await new Promise(resolve => {
    const s = new WebSocket(url, { headers: { 'X-Self-ID': String(BOT), 'X-Client-Role': 'Universal', Authorization: 'Bearer ' + TOKEN } })
    s.once('open', () => resolve(s))
    s.once('error', () => resolve(undefined))
  })
  if (ws === undefined) await new Promise(r => setTimeout(r, 500))
}
log('已连接')

const sent = []
let nextMsgId = 1000
ws.on('message', raw => {
  const req = JSON.parse(String(raw))
  if (!req.action) return
  let data = null
  if (req.action === 'send_private_msg' || req.action === 'send_group_msg') {
    sent.push(req)
    data = { message_id: nextMsgId++ }
  } else if (req.action === 'get_group_member_info') {
    data = { user_id: req.params.user_id, card: req.params.user_id === BOT ? '鱼' : '', nickname: 'nick' + req.params.user_id }
  } else if (req.action === 'get_stranger_info') {
    data = { user_id: req.params.user_id, nickname: '陌生人' }
  } else if (req.action === 'get_group_info') {
    data = { group_id: GROUP, group_name: '测试群' }
  } else if (req.action === 'get_login_info') {
    data = { user_id: BOT, nickname: '测试号' }
  }
  ws.send(JSON.stringify({ status: 'ok', retcode: 0, data, echo: req.echo }))
})
const event = e => ws.send(JSON.stringify({ time: Math.floor(Date.now() / 1000), self_id: BOT, ...e }))
const text = t => ({ type: 'text', data: { text: t } })
const at = qq => ({ type: 'at', data: { qq: String(qq) } })
const privateMsg = (message, user = MASTER) => event({
  post_type: 'message', message_type: 'private', sub_type: 'friend', message_id: nextMsgId++, user_id: user,
  message, raw_message: '', font: 0, sender: { user_id: user, nickname: user === MASTER ? '主人' : '别人' },
})
const groupMsg = (message, group = GROUP, user = OTHER) => event({
  post_type: 'message', message_type: 'group', sub_type: 'normal', message_id: nextMsgId++, group_id: group, user_id: user,
  message, raw_message: '', font: 0, sender: { user_id: user, nickname: '群友', card: '群友' },
})

async function waitFor(pred, what, ms = 60_000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const hit = pred()
    if (hit) return hit
    await new Promise(r => setTimeout(r, 200))
  }
  await fail('等不到：' + what + '\n模型请求：' + JSON.stringify(requests.map(r => ({ last: r.last.slice(0, 60), tools: r.tools.length }))).slice(-3000) + '\n' + dshLog.slice(-4000))
}
const sentCount = () => sent.length
const sentText = req => (req.params.message ?? []).filter(x => x.type === 'text').map(x => x.data.text).join('')
/** 发一条，等她回复发出去 */
async function say(send, what) {
  const before = sentCount()
  send()
  await waitFor(() => sentCount() > before, what)
}
// 按这一轮整条用户消息找（前面可能插了群聊之前的消息）
const reqWith = s => [...requests].reverse().find(r => r.lastAll.includes(s))

// 1. 主人私聊：人格、两份核心记忆、去掉编程助手身份句、有改人格工具
await say(() => privateMsg([text('你好呀 m1')]), '主人私聊回复')
let r = reqWith('m1')
if (!r.system.includes('PERSONA-V1')) await fail('系统提示词里没有人格：' + r.system.slice(0, 500))
if (!r.system.includes('{{这里的花括号不是变量}}')) await fail('人格里的花括号被当成了变量')
if (!r.system.includes('CORE-MASTER') || !r.system.includes('CORE-PUBLIC')) await fail('主人会话应看到两份核心记忆：' + r.system.slice(0, 800))
if (/powered by DeepSeek Harness/.test(r.system)) await fail('编程助手身份句没去掉')
if (!r.tools.includes('persona_edit') || !r.tools.includes('core_memory_edit')) await fail('主人会话没有改人格工具：' + r.tools.join(','))
log('主人私聊：人格、核心记忆、工具 OK')

// 2. 群聊：只有公开核心记忆，没有改人格工具
await say(() => groupMsg([at(BOT), text(' g1')]), '群 @ 回复')
r = reqWith('g1')
if (!r.system.includes('PERSONA-V1') || !r.system.includes('CORE-PUBLIC')) await fail('群聊系统提示词不对：' + r.system.slice(0, 500))
if (r.system.includes('CORE-MASTER')) await fail('群聊看到了主人的核心记忆')
if (r.tools.includes('persona_edit') || r.tools.includes('core_memory_edit')) await fail('群聊里有改人格工具')
log('群聊：只有公开核心记忆、没有改人格工具 OK')

// 2b. 登录设置页接口（阶段 2 的检查要用）
const tokenUrl0 = (dshLog.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+/) ?? [])[0]
if (!tokenUrl0) await fail('dsh 日志里找不到登录网址')
const webBase0 = tokenUrl0.slice(0, tokenUrl0.indexOf('?'))
const login0 = await fetch(tokenUrl0, { redirect: 'manual' })
const cookie0 = (login0.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0]).join('; ')
const api = async (method, path, body) => {
  const res = await fetch(webBase0 + 'api/companion/' + path, { method, headers: { cookie: cookie0, ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
  return { status: res.status, json: await res.json().catch(() => null) }
}

// 2c. 召回：设置页加一条主人记忆，主人问相关的事时，这一轮的消息里带着它（不在系统提示词里）
const added = await api('POST', 'memory/add', { scope: 'master', content: '主人最爱吃的是红烧肉 MEM-1', kind: 'preference', importance: 0.8 })
if (added.json?.action !== 'added') await fail('加记忆失败：' + JSON.stringify(added))
await say(() => privateMsg([text('我最爱吃的红烧肉还记得吗 m1b')]), '召回后的回复')
r = reqWith('m1b')
if (!r.all.includes('<memory>') || !r.all.includes('MEM-1')) await fail('这一轮没带上召回的记忆：' + r.all.slice(-800))
if (r.system.includes('MEM-1')) await fail('召回的记忆不该放进系统提示词')
log('召回的记忆放进这一轮的消息 OK')

// 2d. 群里：有回忆/记住/遗忘工具，没有改人格工具；附上群里最近的消息；想不起主人的记忆
groupMsg([text('没 @ 她的 ctx-a')])
await new Promise(r => setTimeout(r, 800))
await say(() => groupMsg([at(BOT), text(' 红烧肉好吃吗 g1b')]), '群 @ 回复（带之前的消息）')
r = reqWith('g1b')
if (!['memory_search', 'memory_save', 'memory_forget'].every(t => r.tools.includes(t))) await fail('群聊没有记忆工具：' + r.tools.join(','))
if (!r.all.includes('<group_context>') || !r.all.includes('ctx-a')) await fail('没附上群里最近的消息：' + r.all.slice(0, 600))
if (r.all.includes('MEM-1')) await fail('群里想起了主人的记忆')
log('群聊：记忆工具、附上最近的消息、记忆隔离 OK')

// 3. 改人格文件 → 同一个会话下一步就变
writeFileSync(personaFile, '你是测试用的陪伴角色 PERSONA-V2。')
await say(() => privateMsg([text('m2')]), '改人格文件后的回复')
r = reqWith('m2')
// dsh 为了保住缓存，不改开头那份系统提示词，而是把新的追加在对话后面（最新的生效）
const seenV2 = r.system.includes('PERSONA-V2') || r.raw.includes('PERSONA-V2')
if (!seenV2) await fail('改了人格文件，正在聊的会话没变：' + r.raw.slice(-1500))
log('改人格文件后正在聊的会话下一步就变 OK（' + (r.system.includes('PERSONA-V2') ? '开头' : '追加在对话后面') + '）')

// 4. 她用工具改人格
await say(() => privateMsg([text('m3 改人格')]), '工具改人格后的回复')
await waitFor(() => readFileSync(personaFile, 'utf-8').includes('芒果'), '人格文件被工具改掉')
const hist = readdirSync(join(data, 'persona', 'history')).filter(n => n.endsWith('.json'))
if (hist.length !== 1) await fail('改人格应该留 1 份历史，实际 ' + hist.length)
if (reviewPrompts.length !== 1 || !reviewPrompts[0].includes('芒果')) await fail('改人格前没有审核')
// 不合适的修改被退回：人格不变，她拿到原因
await say(() => privateMsg([text('m3b 违规改人格')]), '违规改人格后的回复')
if (readFileSync(personaFile, 'utf-8').includes('火锅')) await fail('不合适的人格修改没被退回')
if (!requests.some(q => q.raw.includes('没通过审核'))) await fail('她没拿到退回的原因')
log('她用工具改人格、留历史版本、不合适的被退回 OK')

// 5. 群聊按轮截断（最多 3 轮，一次截 2 轮）
for (const g of ['g2', 'g3', 'g4']) await say(() => groupMsg([at(BOT), text(' ' + g)]), '群 ' + g)
r = reqWith('g4')
// 群聊上下文会再附上最近几条群消息（可能含被截掉的），所以只看对话本身
const convo = r.all.replace(/<group_context>[\s\S]*?<\/group_context>/g, '')
if (convo.includes(' g1') || !convo.includes('已经省略')) await fail('群聊没有按轮截断：' + convo.slice(0, 600))
log('群聊按轮截断 OK')

// 6. 主人按轮 LLM 压缩（最多 6 轮，一次压 3 轮）
for (const m of ['m4', 'm5', 'm6', 'm7']) await say(() => privateMsg([text(m)]), '主人 ' + m)
await waitFor(() => requests.some(x => x.all.includes('回忆：我们聊过苹果和香蕉')), '压缩后的请求里带着回忆')
r = reqWith('m7')
if (r.all.includes('你好呀 m1')) await fail('主人会话压缩后还带着最早的消息')
if (!requests.some(x => x.all.includes('现在暂停聊天') || x.last.includes('现在暂停聊天'))) await fail('没有用中文回忆指令')
log('主人会话中文回忆压缩 OK')

// 7. 超出上限：截断后重试成功（别人的私聊）
for (const x of ['x1', 'x2']) await say(() => privateMsg([text(x)], OTHER), '别人私聊 ' + x)
await say(() => privateMsg([text('超长 x3')], OTHER), '超出上限后重试的回复')
// 截断说明和这条新消息挨着，会被合并成同一条用户消息，所以按全文找重试的那次请求
const retry = requests.find(q => q.all.includes('超长') && q.all.includes('已经省略'))
if (retry === undefined) await fail('超出上限后没有截断再重试：' + JSON.stringify(requests.slice(-2).map(q => q.all.slice(0, 300))))
if (retry.all.includes('x1')) await fail('重试时还带着最早的消息：' + retry.all.slice(0, 800))
log('超出上限截断后重试 OK')

// 7b. 整理：压缩前已经整理过（群和主人），手动整理再把剩下的整理掉；记忆按归属分开
if (!extractions.some(e => e.includes('QQ 群'))) await fail('群聊截断前没有先整理')
if (!extractions.some(e => e.includes('和主人的私聊'))) await fail('主人会话压缩前没有先整理')
const organized = await api('POST', 'organize', { wait: true })
if (organized.status !== 200) await fail('手动整理失败：' + JSON.stringify(organized))
const listed = await api('GET', 'memory?status=active&limit=100')
const scopes = Object.fromEntries((listed.json?.items ?? []).map(m => [m.content, m.scope]))
if (scopes['整理出来的记忆 ORG-GROUP'] !== 'group:' + GROUP || scopes['整理出来的记忆 ORG-MASTER'] !== 'master' || scopes['整理出来的记忆 ORG-OTHER'] !== 'user:' + OTHER) await fail('整理出来的记忆归属不对：' + JSON.stringify(scopes))
log('压缩前整理、手动整理、记忆归属 OK（模型整理了 ' + extractions.length + ' 次）')

// 7c. 向量索引：填了 Key 就在后台补算
let idx
for (let i = 0; i < 40; i++) {
  idx = (await api('GET', 'index')).json
  if (idx?.state === 'done' && idx.embedded === idx.total) break
  await new Promise(r => setTimeout(r, 500))
}
if (idx?.state !== 'done' || idx.embedded !== idx.total || idx.dim !== 4 || embedCalls.length === 0) await fail('向量索引没建好：' + JSON.stringify(idx))
const rebuilt = await api('POST', 'index/rebuild', {})
if (rebuilt.status !== 200) await fail('手动重建失败：' + JSON.stringify(rebuilt))
log('向量索引 OK（' + idx.embedded + ' 条，' + idx.dim + ' 维）')
const et = await api('POST', 'embed/test', {})
if (!et.json?.ok || et.json.model !== 'fake-embed' || !(et.json.dim > 0)) await fail('测试向量接口不对：' + JSON.stringify(et.json))
log('测试向量接口按钮 OK（' + et.json.dim + ' 维）')

// 7d. 接口里遗忘：主人记忆普通遗忘后能恢复；彻底遗忘后不能再加回来
const mem1 = (listed.json?.items ?? []).find(m => m.content.includes('MEM-1'))
if ((await api('POST', 'memory/' + mem1.id + '/forget', {})).json?.ok !== true) await fail('普通遗忘失败')
if ((await api('GET', 'memory?status=forgotten')).json?.total !== 1) await fail('普通遗忘后列表不对')
if ((await api('POST', 'memory/' + mem1.id + '/restore', {})).json?.ok !== true) await fail('恢复失败')
if ((await api('POST', 'memory/' + mem1.id + '/purge', {})).json?.ok !== true) await fail('彻底遗忘失败')
const again = await api('POST', 'memory/add', { scope: 'master', content: '主人最爱吃的是红烧肉 MEM-1' })
if (again.json?.action !== 'blocked') await fail('彻底遗忘的内容又被加回来了：' + JSON.stringify(again))
log('遗忘、恢复、彻底遗忘、指纹挡住回写 OK')

// 8a. 白名单之外的收发消息与图片不能存档；管理员仍能正常回复，但不能豁免群存档。
const downloadsBefore = imageDownloads
const blockedImage = { type: 'image', data: { file: 'blocked.png', url: imgUrl + '?blocked', summary: '[图片]' } }
groupMsg([text('BLOCKED-ARCHIVE-unwoken'), blockedImage], GROUP + 10)
groupMsg([at(BOT), text('BLOCKED-ARCHIVE-woken')], GROUP + 10)
groupMsg([text('/help BLOCKED-ARCHIVE-command')], GROUP + 10)
privateMsg([text('BLOCKED-ARCHIVE-private'), blockedImage], OTHER + 10)
await say(() => groupMsg([at(BOT), text('BLOCKED-ARCHIVE-admin')], GROUP + 10, MASTER), '管理员仍能在名单外群回复')
await new Promise(r => setTimeout(r, 700))
const blockedDb = new DatabaseSync(join(data, 'companion.db'))
const blockedRows = blockedDb.prepare('SELECT count(*) AS n FROM messages WHERE text LIKE ? OR group_id = ? OR user_id = ?').get('%BLOCKED-ARCHIVE%', String(GROUP + 10), String(OTHER + 10))
blockedDb.close()
if (blockedRows.n !== 0) await fail('名单外群或普通私聊被存档：' + blockedRows.n)
if (imageDownloads !== downloadsBefore) await fail('名单外图片被存档下载')
log('存档白名单 OK（名单外群含管理员收发、普通私聊、图片均未存）')

// 8. 白名单内没唤醒的群消息也存档；收到、发出都存
groupMsg([text('没有 @ 她的群消息')])
await new Promise(r => setTimeout(r, 1500))
const db = new DatabaseSync(join(data, 'companion.db'))
const rows = db.prepare('SELECT direction, woke, text, kind FROM messages').all()
db.close()
if (!rows.some(x => x.text.includes('没有 @ 她的群消息') && x.woke === 0)) await fail('没唤醒的群消息没存档')
if (!rows.some(x => x.direction === 'out' && x.text.includes('回复:'))) await fail('她发出的消息没存档')
if (!rows.some(x => x.direction === 'in' && x.kind === 'private' && x.text.includes('m2'))) await fail('收到的私聊没存档')
log('消息存档 OK（' + rows.length + ' 条）')

// 9. 设置页接口：要登录；改文件要 JSON 请求
const tokenUrl = (dshLog.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+/) ?? [])[0]
if (!tokenUrl) await fail('dsh 日志里找不到登录网址')
const webBase = tokenUrl.slice(0, tokenUrl.indexOf('?'))
const anon = await fetch(webBase + 'api/companion/state')
if (anon.status !== 401) await fail('没登录也能访问 companion 接口：' + anon.status)
const login = await fetch(tokenUrl, { redirect: 'manual' })
const cookie = (login.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0]).join('; ')
const st = await (await fetch(webBase + 'api/companion/state', { headers: { cookie } })).json()
if (!st.docs?.persona?.text.includes('芒果') || st.docs.persona.history.length !== 1 || !(st.archive?.total > 0)) await fail('state 接口不对：' + JSON.stringify(st).slice(0, 400))
const form = await fetch(webBase + 'api/companion/doc/persona', { method: 'POST', headers: { cookie, 'content-type': 'text/plain' }, body: JSON.stringify({ text: 'x' }) })
if (form.status !== 415) await fail('非 JSON 请求也能改人格：' + form.status)
const ok = await fetch(webBase + 'api/companion/doc/persona', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ text: '你是 PERSONA-V3。' }) })
if (!ok.ok || !readFileSync(personaFile, 'utf-8').includes('PERSONA-V3')) await fail('设置页改人格失败：' + ok.status)
log('设置页接口 OK（需登录、改文件要 JSON）')
// ===== 阶段 3 =====
// 10. 写日记（只写主人的）
const ran = await api('POST', 'maintenance', { what: 'diary' })
if (ran.status !== 200 || ran.json?.report?.diary?.written !== true) await fail('写日记失败：' + JSON.stringify(ran.json?.report ?? ran))
const diaryList = (await api('GET', 'diary')).json
if (diaryList?.days?.length !== 1) await fail('日记列表不对：' + JSON.stringify(diaryList))
const today = (await api('GET', 'diary/' + diaryList.days[0].date)).json
if (!today?.text?.includes('DIARY-1')) await fail('日记内容不对：' + JSON.stringify(today))
if (diaryPrompts[0].includes('g1b') || diaryPrompts[0].includes('ctx-a')) await fail('日记里混进了群里的事')
const imported = await api('POST', 'diary/import', { conflict: 'skip', files: [{ name: '2026-10-19.md', text: '# 10月19日\n旧日记 OLD-DIARY' }, { name: 'x.md', text: '没有日期' }, { name: diaryList.days[0].date + '.md', text: '同一天' }] })
const results = imported.json?.results?.map(r => r.result)
if (JSON.stringify(results) !== JSON.stringify(['added', 'no-date', 'skipped'])) await fail('导入日记结果不对：' + JSON.stringify(imported.json))
log('写日记、导入旧日记 OK（' + diaryList.days[0].date + '）')

// 11. 群消息图片收到时下载；群聊上下文用下载好的图
groupMsg([text('看图'), { type: 'image', data: { file: 'a.png', url: imgUrl, summary: '[图片]' } }])
const mediaDir = join(data, 'media')
await waitFor(() => existsSync(mediaDir) && readdirSync(mediaDir).length > 0, '群消息图片下载好')
await say(() => groupMsg([at(BOT), text(' 图里是什么 g9')]), '带图片的群聊上下文')
r = reqWith('g9')
if (!r.lastAll.includes('看图') || r.images < 1) await fail('群聊上下文没带上下载好的图片：images=' + r.images + ' ' + r.lastAll.slice(0, 300))
log('群消息图片下载、群聊上下文带图 OK')

// 12. 模拟过了 6 天：群会话换新，旧会话归档后真的删掉文件夹，dsh 照常能用
const sessionDirs = id => readdirSync(join(home, 'sessions')).filter(p => existsSync(join(home, 'sessions', p, id)))
const oldGroup = 'napcat-napcat-GroupMessage-' + GROUP
if (sessionDirs(oldGroup).length !== 1) await fail('找不到群会话的文件夹：' + JSON.stringify(readdirSync(join(home, 'sessions'))))
const sixDays = await api('POST', 'maintenance', { what: 'expire', now: Date.now() + 6 * 86_400_000 })
const rep6 = sixDays.json?.report
if (!rep6?.expired?.some(e => e.umo === 'napcat:GroupMessage:' + GROUP && e.rotated)) await fail('群会话没有换新：' + JSON.stringify(rep6))
if (!rep6.deletedSessions.includes(oldGroup)) await fail('旧群会话没有删掉：' + JSON.stringify(rep6))
if (sessionDirs(oldGroup).length !== 0) await fail('旧群会话的文件夹还在')
if (rep6.failedSessions.length > 0) await fail('删会话有失败：' + JSON.stringify(rep6.failedSessions))
await say(() => groupMsg([at(BOT), text(' 新会话里的第一句 g10')]), '换会话后群里的回复')
r = reqWith('g10')
if (!r.lastAll.includes('<previous_session>')) await fail('新会话开头没带上个会话的内容：' + r.lastAll.slice(0, 400))
if (/ERR|Error|unhandled/i.test(dshLog.split('删掉了已归档的旧会话')[1] ?? '')) await fail('删会话以后 dsh 报错：' + dshLog.slice(-2000))
log('过了 6 天：群会话换新、旧会话删掉、dsh 照常 OK')

// 13. 模拟过了 400 天：主人会话换新，旧的只归档不删；新会话开头先读日记
const oldMaster = 'napcat-napcat-FriendMessage-' + MASTER
const years = await api('POST', 'maintenance', { what: 'expire', now: Date.now() + 400 * 86_400_000 })
const repY = years.json?.report
if (!repY?.expired?.some(e => e.umo === 'napcat:FriendMessage:' + MASTER && e.rotated)) await fail('主人会话没有换新：' + JSON.stringify(repY))
if (repY.deletedSessions.includes(oldMaster) || sessionDirs(oldMaster).length !== 1) await fail('主人的旧会话被删了')
const retiredMaster = years.json.state.retired.find(x => x.sessionId === oldMaster)
if (retiredMaster?.state !== 'archived') await fail('主人的旧会话不是归档状态：' + JSON.stringify(retiredMaster))
await say(() => privateMsg([text('新的一年 m99')]), '主人新会话的回复')
r = reqWith('m99')
if (!r.lastAll.includes('<diary>') || !r.lastAll.includes('DIARY-1')) await fail('主人新会话开头没先读日记：' + r.lastAll.slice(0, 500))
log('过了 400 天：主人会话换新、旧的只归档、新会话先读日记 OK')

// ===== 阶段 4 =====
// 15. 主动聊天：她说话就发；回「[不发]」就不发；群里带上下文
let before = sentCount()
const tried = await api('POST', 'proactive/try', { umo: 'napcat:FriendMessage:' + MASTER })
if (tried.status !== 200) await fail('主动唤醒失败：' + JSON.stringify(tried.json))
const pro = await waitFor(() => sent.slice(before).find(x => x.action === 'send_private_msg'), '主动发出的私聊')
if (sentText(pro) !== '在忙吗？PRO-1' || pro.params.user_id !== MASTER) await fail('主动发的不对：' + JSON.stringify(pro.params))
proactiveSilent = true
before = sentCount()
await api('POST', 'proactive/try', { umo: 'napcat:FriendMessage:' + MASTER })
await waitFor(() => proactivePrompts.length >= 2, '第二次主动唤醒')
await new Promise(r => setTimeout(r, 2000))
if (sentCount() !== before) await fail('她回了「[不发]」还是发出去了')
proactiveSilent = false
// 上面模拟过了 400 天，群存档已经删光：先有人在群里说一句
groupMsg([text('群里最近的一句 ctx-p')])
await new Promise(r => setTimeout(r, 800))
const gtry = await api('POST', 'proactive/try', { umo: 'napcat:GroupMessage:' + GROUP })
if (gtry.status !== 200) await fail('群里主动唤醒失败：' + JSON.stringify(gtry.json) + dshLog.slice(-1500))
await waitFor(() => proactivePrompts.some(p => p.includes('群里最近的消息')), '群里主动带上下文')
if (!proactivePrompts.find(p => p.includes('群里最近的消息')).includes('ctx-p')) await fail('群里主动没带上下文')
log('主动聊天：发、不发、群里带上下文 OK')

// 16. 整合相近的记忆、撤销
await api('POST', 'memory/add', { scope: 'master', content: '主人养了一只猫 CAT' })
await api('POST', 'memory/add', { scope: 'master', content: '主人养了一只猫叫咪咪 CAT' })
const careRun = await api('POST', 'care/run', {})
if (!(careRun.json?.report?.consolidate?.groups >= 1)) await fail('定期整合没合并：' + JSON.stringify(careRun.json?.report))
const cats = (await api('GET', 'memory?q=CAT')).json
if (!cats.items.some(m => m.content.includes('咪咪的橘猫'))) await fail('整合后没有新记忆：' + JSON.stringify(cats))
const undone = await api('POST', 'care/undo', {})
if (undone.json?.undone < 1 || (await api('GET', 'memory?q=CAT')).json.items.some(m => m.content.includes('橘猫'))) await fail('撤销整合不对')
log('定期整合、撤销 OK')

// 17. 备份：手动备份、下载；改掉人格后从备份还原（插件自动重新加载），还原后自检
const ALL_ITEMS = ['persona', 'core', 'diary', 'memory', 'archiveMaster', 'archiveOthers', 'settingsCompanion', 'settingsBridge', 'settingsDsh']
const made = await api('POST', 'backup/create', { items: ALL_ITEMS })
if (!made.json?.name) await fail('手动备份失败：' + JSON.stringify(made.json))
const dl = await fetch(webBase0 + 'api/companion/backup/file/' + made.json.name, { headers: { cookie: cookie0 } })
const bytes = Buffer.from(await dl.arrayBuffer())
if (!dl.ok || bytes[0] !== 0x1f || bytes[1] !== 0x8b) await fail('下载备份不对：' + dl.status)
// 包里有两个插件的设置，但没有 Key 和 Token
const tarText = (await import('node:zlib')).gunzipSync(bytes).toString('utf-8')
if (!tarText.includes('typingCharsPerMinute') || !tarText.includes('masterMaxRounds') || !tarText.includes('selectedDefault')) await fail('备份包里没有插件设置或 dsh 设置')
if (tarText.includes(TOKEN) || tarText.includes('e2e-embed-key')) await fail('备份包里有 Key 或 Token')
writeFileSync(personaFile, '你是 PERSONA-V4（备份之后改的）')
// 备份之后新记的记忆：下面不还原记忆库，它应该还在
await api('POST', 'memory/add', { scope: 'master', content: '备份之后记的 AFTER-BACKUP-MEM', kind: 'fact', importance: 0.5 })
const preview = await api('POST', 'backup/restore', { name: made.json.name })
const importing = preview.json?.importing
if (!importing?.id || !(importing.manifest?.counts?.memories > 0) || JSON.stringify(importing.manifest).includes('e2e-embed-key')) await fail('还原预览不对：' + JSON.stringify(preview.json).slice(0, 500))
if (JSON.stringify(importing.manifest.items) !== JSON.stringify(ALL_ITEMS)) await fail('备份内容勾选不对：' + JSON.stringify(importing.manifest.items))
const confirmed = await api('POST', 'backup/confirm', { id: importing.id, items: ALL_ITEMS.filter(i => i !== 'memory') })
if (!confirmed.json?.restarting) await fail('确认还原失败：' + JSON.stringify(confirmed.json))
let after
for (let i = 0; i < 40; i++) {
  await new Promise(r => setTimeout(r, 500))
  after = await api('GET', 'state').catch(() => null)
  if (after?.json?.lastImport && after.json.selfCheck) break
}
if (!after?.json?.lastImport || after.json.lastImport.error) await fail('还原后状态不对：' + JSON.stringify(after?.json?.lastImport))
if (!readFileSync(personaFile, 'utf-8').includes('PERSONA-V3')) await fail('还原后人格不对：' + readFileSync(personaFile, 'utf-8'))
if (!after.json.backups.some(b => b.reason === 'before-import')) await fail('还原前没有自动备份当前数据')
if (after.json.lastImport.plan?.items?.includes('memory') || !['dsh-napcat-bridge 的设置：已套用', 'dsh-companion-core 的设置：已套用', 'dsh 设置 agent-preset-registry：已套用'].every(x => (after.json.lastImport.plan?.notes ?? []).includes(x))) await fail('还原勾选或设置套用不对：' + JSON.stringify(after.json.lastImport.plan))
if (!(await api('GET', 'memory?q=AFTER-BACKUP-MEM')).json.items.some(m => m.content.includes('AFTER-BACKUP-MEM'))) await fail('没勾记忆库，记忆却被换掉了')
if (!Array.isArray(after.json.selfCheck?.results) || after.json.selfCheck.results.length !== 3) await fail('还原后没自检：' + JSON.stringify(after.json.selfCheck))
await say(() => privateMsg([text('还原以后还在吗 m200')]), '还原以后的回复')

// 18. 图记忆：两条记忆抽出关系网；聊「咪咪」时能想起没出现「咪咪」的那条（顺着 咪咪—橘猫 走一步）
await api('POST', 'memory/add', { scope: 'master', content: '主人养的橘猫名字叫咪咪 GR-1', kind: 'fact', importance: 0.6 })
await api('POST', 'memory/add', { scope: 'master', content: '那只橘猫上周打了疫苗 GR-2', kind: 'event', importance: 0.5 })
let gst
for (let i = 0; i < 60; i++) {
  gst = (await api('GET', 'state')).json?.graph
  if (gst && gst.state === 'done' && gst.counts.done === gst.counts.memories && gst.sample.some(x => x.rel === '打了')) break
  await new Promise(r => setTimeout(r, 500))
}
if (!gst || gst.state !== 'done' || !gst.sample.some(x => x.rel === '打了')) await fail('关系网没抽好：' + JSON.stringify(gst))
if (graphPrompts.length === 0 || graphPrompts.some(p => p.includes('今天的日记'))) await fail('抽关系的请求不对（日记不该抽）')
await say(() => privateMsg([text('咪咪最近好吗 gq1')]), '图记忆召回后的回复')
r = reqWith('gq1')
if (!r.all.includes('GR-2')) await fail('图记忆没顺着关系想起来：' + r.all.slice(-800))
const graphRebuild = await api('POST', 'graph/rebuild', {})
if (graphRebuild.status !== 200 || !graphRebuild.json?.graph) await fail('关系网手动重建接口不对：' + JSON.stringify(graphRebuild))
log('图记忆：补抽关系网、顺着关系召回、手动重建 OK')
log('备份、下载、还原（插件重新加载）、自检 OK')

// 19. 给其他插件的接口：公开的拿不到主人的核心记忆；主人的能拿到；带问题时附上相关记忆；能替她记一件事
{
  const svc = (op, extra) => api('POST', 'test/service', { op, ...extra })
  const pub = (await svc('identity', {})).json
  const mas = (await svc('identity', { target: { audience: 'master' } })).json
  if (!pub?.prompt?.includes('CORE-PUBLIC') || pub.prompt.includes('CORE-MASTER') || pub.audience !== 'public') await fail('公开的身份不对：' + JSON.stringify(pub).slice(0, 300))
  if (!mas?.prompt?.includes('CORE-MASTER') || !mas.persona) await fail('主人的身份不对：' + JSON.stringify(mas).slice(0, 300))
  const rem = (await svc('remember', { content: '看了一个讲深海鱼的视频 PLUGIN-MEM', options: { by: 'e2e-bilibili' } })).json
  if (!rem?.ok) await fail('替她记一件事失败：' + JSON.stringify(rem))
  const hits = (await svc('recall', { query: '深海鱼 视频 PLUGIN-MEM' })).json
  if (!Array.isArray(hits) || !hits.some(m => m.content.includes('PLUGIN-MEM'))) await fail('接口召回不到：' + JSON.stringify(hits).slice(0, 300))
  const full = (await svc('prompt', { target: { query: '深海鱼 视频 PLUGIN-MEM' } })).json
  if (!full?.text?.includes('PLUGIN-MEM') || !full.text.includes('CORE-PUBLIC')) await fail('接口整段提示词不对：' + String(full?.text).slice(0, 300))
  const noBy = (await svc('remember', { content: 'x', options: {} })).json
  if (noBy?.ok) await fail('没写 by 也记上了')
  log('给其他插件的接口（身份、召回、整段提示词、替她记）OK')
}

// 20. 设置页选模型：dsh 里的模型列表、思考等级、用保存过的设置测试整理用的模型、别家没填时说清楚
{
  const models = (await api('GET', 'llm/dsh-models')).json
  if (!Array.isArray(models?.providers) || models.providers.length === 0) await fail('读不到 dsh 的模型列表：' + JSON.stringify(models).slice(0, 300))
  const eff = (await api('POST', 'llm/efforts', { task: 'memory' })).json
  if (!Array.isArray(eff?.efforts)) await fail('思考等级接口不对：' + JSON.stringify(eff).slice(0, 300))
  const tested = (await api('POST', 'llm/test', { task: 'memory' })).json
  if (!tested?.ok) await fail('测试整理用的模型失败：' + JSON.stringify(tested).slice(0, 300))
  const noApi = (await api('POST', 'llm/models', { task: 'memory', apiUrl: 'not-a-url' })).json
  if (noApi?.ok !== false) await fail('别家地址不对时应该说清楚：' + JSON.stringify(noApi))
  // 写日记：用和主人私聊用的模型（测试环境里 dsh-napcat-bridge 的默认是 deepseek-official/deepseek-flash），思考等级默认 high
  const diaryEff = (await api('POST', 'llm/efforts', { task: 'diary' })).json
  if (diaryEff?.from !== 'admin' || diaryEff?.model?.model !== 'deepseek-flash') await fail('写日记用的模型不对：' + JSON.stringify(diaryEff).slice(0, 300))
  const diaryTest = (await api('POST', 'llm/test', { task: 'diary' })).json
  if (!diaryTest?.ok || diaryTest.effort !== 'high') await fail('测试写日记的模型不对：' + JSON.stringify(diaryTest).slice(0, 300))
  log('设置页选模型：dsh 模型列表、思考等级、测试模型、写日记的模型 OK')
}

// 14. 删过会话以后重启 dsh：能正常起来、不报错、设置页接口照常
if (!process.env.E2E_HOLD) {
  finished = true
  const exited = new Promise(resolve => dsh.once('exit', resolve))
  dsh.kill('SIGTERM')
  await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 15_000))])
  ws.close()
  let log2 = ''
  const dsh2 = spawn(process.env.DSH_BIN ?? 'dsh', ['web', '--host', '127.0.0.1', '--port', '0', '--no-open'], {
    env: { ...process.env, DSH_HOME: home, DEEPSEEK_API_KEY: 'sk-e2e-fake', DEEPSEEK_BASE_URL: llmUrl, DSH_TELEMETRY_DISABLED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  for (const st of [dsh2.stdout, dsh2.stderr]) st.on('data', d => { log2 += d })
  const end = Date.now() + 90_000
  while (!/dsh web: http/.test(log2) && Date.now() < end && dsh2.exitCode === null) await new Promise(r => setTimeout(r, 300))
  const url2 = (log2.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+/) ?? [])[0]
  let ok2 = false
  if (url2) {
    const base2 = url2.slice(0, url2.indexOf('?'))
    const login2 = await fetch(url2, { redirect: 'manual' })
    const cookie2 = (login2.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0]).join('; ')
    const st2 = await fetch(base2 + 'api/companion/state', { headers: { cookie: cookie2 } })
    ok2 = st2.ok && (await st2.json()).retired?.some(x => x.sessionId === oldGroup && x.state === 'deleted')
  }
  dsh2.kill('SIGTERM')
  await new Promise(r => setTimeout(r, 1500))
  if (!url2 || !ok2 || /Error|unhandled|ENOENT/.test(log2)) {
    console.error(log2.slice(-3000))
    await fail('删过会话以后重启 dsh 不正常')
  }
  log('删过会话以后重启 dsh 正常 OK')
}

log('全部通过')
if (process.env.E2E_HOLD) {
  log('保留运行中，dsh 网页：http://127.0.0.1:' + (process.env.E2E_WEB_PORT ?? '?') + '/')
  await new Promise(() => {})
}
ws.close()
await cleanup()
process.exit(0)
