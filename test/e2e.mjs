#!/usr/bin/env node
// 端到端测试：真实的 dsh web 同时加载插件一（dsh-napcat-bridge，在旁边的文件夹）和本插件，
// 假的 DeepSeek 接口回答模型请求，假的 NapCat 作为客户端连插件一。
//
// 检查：人格和核心记忆替换进系统提示词（主人/群聊看到的核心记忆不同，编程助手身份句去掉）；
// 改人格文件后同一个会话下一步就变；主人会话有改人格工具、群里没有；她用工具改人格后文件真的变了并留了历史；
// 群聊超过轮数按轮截断；主人超过轮数用中文回忆压缩；模型报超出上限时截断后重试成功；
// 消息存档（收到、发出、没唤醒的群消息）；设置页接口要登录、改文件要 JSON 请求。
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
let overflowOnce = true
const textOf = content => (typeof content === 'string' ? content : (content ?? []).filter(b => b.type === 'text').map(b => b.text).join('\n'))
const firstText = content => (typeof content === 'string' ? content : (content ?? []).find(b => b.type === 'text')?.text ?? '')
const llm = createServer((req, res) => {
  let body = ''
  req.on('data', c => { body += c })
  req.on('end', () => {
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
    const entry = { system, last, all, raw: JSON.stringify(json.messages ?? []), tools: (json.tools ?? []).map(t => t.name), toolResult }
    requests.push(entry)
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
    if (lastAll.includes('现在暂停聊天')) return text('回忆：我们聊过苹果和香蕉。')
    if (last.includes('超长') && overflowOnce) {
      overflowOnce = false
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'prompt is too long for this model' } }))
      return
    }
    if (toolResult) return text('改好了')
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
    agentPreset: companion
    datetimeReminder: false
- id: companion-core
  config:
    logLevel: debug
    masterMaxRounds: 6
    masterDropRounds: 3
    privateMaxRounds: 50
    groupMaxRounds: 3
    groupDropRounds: 2
`)
const data = join(home, 'companion')
mkdirSync(join(data, 'persona'), { recursive: true })
mkdirSync(join(data, 'core'), { recursive: true })
const personaFile = join(data, 'persona', 'persona.md')
writeFileSync(personaFile, '你是测试用的陪伴角色 PERSONA-V1。{{这里的花括号不是变量}}')
writeFileSync(join(data, 'core', 'master.md'), '- CORE-MASTER：主人爱吃红烧肉')
writeFileSync(join(data, 'core', 'public.md'), '- CORE-PUBLIC：我是一条鱼')

const dsh = spawn(process.env.DSH_BIN ?? 'dsh', ['web', '--host', '127.0.0.1', '--port', process.env.E2E_WEB_PORT ?? '0', '--no-open'], {
  env: { ...process.env, DSH_HOME: home, DEEPSEEK_API_KEY: 'sk-e2e-fake', DEEPSEEK_BASE_URL: llmUrl, DSH_TELEMETRY_DISABLED: '1' },
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
const groupMsg = message => event({
  post_type: 'message', message_type: 'group', sub_type: 'normal', message_id: nextMsgId++, group_id: GROUP, user_id: OTHER,
  message, raw_message: '', font: 0, sender: { user_id: OTHER, nickname: '群友', card: '群友' },
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
/** 发一条，等她回复发出去 */
async function say(send, what) {
  const before = sentCount()
  send()
  await waitFor(() => sentCount() > before, what)
}
const reqWith = s => [...requests].reverse().find(r => r.last.includes(s))

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
log('她用工具改人格、留历史版本 OK')

// 5. 群聊按轮截断（最多 3 轮，一次截 2 轮）
for (const g of ['g2', 'g3', 'g4']) await say(() => groupMsg([at(BOT), text(' ' + g)]), '群 ' + g)
r = reqWith('g4')
if (r.all.includes(' g1') || !r.all.includes('已经省略')) await fail('群聊没有按轮截断：' + r.all.slice(0, 600))
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

// 8. 没唤醒的群消息也存档；收到、发出都存
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

log('全部通过')
if (process.env.E2E_HOLD) {
  log('保留运行中，dsh 网页：http://127.0.0.1:' + (process.env.E2E_WEB_PORT ?? '?') + '/')
  await new Promise(() => {})
}
ws.close()
await cleanup()
process.exit(0)
