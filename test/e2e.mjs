#!/usr/bin/env node
// 端到端测试：真实的 dsh web 加载本插件，假的 DeepSeek 接口回答模型请求，
// 假的 SnowLuma 作为客户端连插件的反向 WebSocket。
//
// 检查：Token 缺失 401、错误 403；私聊直接交给模型并用 send_private_msg 回复；
// 群里不 @ 不回；@ 机器人会回（@ 用 get_group_member_info 查名片）；唤醒前缀 / 会被去掉；
// 引用机器人的消息会唤醒（用 get_msg 取被引用消息）；QQ 管家的消息被忽略。
//
// 需要：DSH_BIN 指向 dsh 可执行文件（或 dsh 在 PATH 上），先 pnpm run build。
// 不联网、不需要真实 API Key。用法：node test/e2e.mjs（退出码 0 = 通过）
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import WebSocket from 'ws'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TOKEN = 'e2e-token'
const GROUP_REPLY = process.env.E2E_GROUP_REPLY === '1'
const USER = 123450001
const BOT = 123450009
const GROUP = 888000001
const WS_PORT = 18000 + Math.floor(Math.random() * 1000)
const deadline = Date.now() + Number(process.env.E2E_TIMEOUT_MS ?? 180_000)

const log = (...a) => console.log('[e2e]', ...a)
let finished = false
const fail = async message => { console.error('[e2e] FAIL: ' + message); await cleanup(); process.exit(1) }

// ---- 假 DeepSeek（Anthropic Messages 流式），回复 = "回复:" + 最后一条用户消息的第一个文字块
const modelRequests = []
const modelFull = []
const modelImages = []
const lastUserText = json => {
  const user = [...(json.messages ?? [])].reverse().find(m => m.role === 'user')
  if (!user) return ''
  const content = typeof user.content === 'string' ? [{ type: 'text', text: user.content }] : user.content
  // dsh 会在后面追加环境信息块，QQ 消息是第一个文字块
  return content.find(b => b.type === 'text')?.text ?? ''
}
const llm = createServer((req, res) => {
  let body = ''
  req.on('data', c => { body += c })
  req.on('end', () => {
    if (req.method !== 'POST' || !req.url.endsWith('/messages')) {
      res.writeHead(404, { 'content-type': 'application/json' }).end('{"error":{"message":"not found"}}')
      return
    }
    const json = JSON.parse(body || '{}')
    const text = lastUserText(json)
    modelRequests.push(text)
    const lastUser = [...(json.messages ?? [])].reverse().find(m => m.role === 'user')
    modelFull.push(typeof lastUser?.content === 'string' ? lastUser.content : (lastUser?.content ?? []).filter(b => b.type === 'text').map(b => b.text).join('\n'))
    const user = [...(json.messages ?? [])].reverse().find(m => m.role === 'user')
    modelImages.push(Array.isArray(user?.content) ? user.content.filter(b => b.type === 'image').length : 0)
    const reply = '回复:' + text
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
    const ev = (type, data) => res.write('event: ' + type + '\ndata: ' + JSON.stringify({ type, ...data }) + '\n\n')
    ev('message_start', { message: { id: 'msg_e2e', type: 'message', role: 'assistant', model: json.model ?? 'e2e', content: [], usage: { input_tokens: 10, output_tokens: 0 } } })
    if (text.includes('THINK-ONLY')) {
      // 模拟 DeepSeek 偶尔只在思考里打草稿、正文是空的
      ev('content_block_start', { index: 0, content_block: { type: 'thinking', thinking: '' } })
      ev('content_block_delta', { index: 0, delta: { type: 'thinking_delta', thinking: '草稿：我想回一句话' } })
      ev('content_block_stop', { index: 0 })
    } else {
      ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } })
      ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: reply } })
      ev('content_block_stop', { index: 0 })
    }
    ev('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 5 } })
    ev('message_stop', {})
    res.end()
  })
})
await new Promise(r => llm.listen(0, '127.0.0.1', r))

// ---- 图片服务器：给假 SnowLuma 的图片地址用（1x1 PNG）
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const imgServer = createServer((_req, res) => res.writeHead(200, { 'content-type': 'image/png' }).end(PNG))
await new Promise(r => imgServer.listen(0, '127.0.0.1', r))
const imgUrl = 'http://127.0.0.1:' + imgServer.address().port + '/a.png'
const llmUrl = 'http://127.0.0.1:' + llm.address().port + '/anthropic'

// ---- 独立的 DSH_HOME，本仓库作为 profile bundle
const home = mkdtempSync(join(tmpdir(), 'dsh-snowluma-e2e-'))
const profile = join(home, 'profiles', 'web')
mkdirSync(join(profile, 'node_modules'), { recursive: true })
symlinkSync(ROOT, join(profile, 'node_modules', 'dsh-snowluma-bridge'), 'dir')
writeFileSync(join(profile, 'package.json'), JSON.stringify({
  name: 'dsh-profile-web', private: true,
  dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'dsh-snowluma-bridge'] } },
  dependencies: { 'dsh-snowluma-bridge': 'link:' + ROOT },
}, null, 2))
const workspace = join(home, 'workspace')
mkdirSync(workspace)
writeFileSync(join(profile, 'cordis.patch.yml'), `- id: snowluma-bridge
  config:
    ws_reverse_host: 127.0.0.1
    ws_reverse_port: ${WS_PORT}
    ws_reverse_token: ${TOKEN}
    workspacePath: ${workspace}
    admins: ['${USER}', '${USER + 1}']
    whitelist: ['snowluma:GroupMessage:${GROUP}', 'snowluma:FriendMessage:${USER + 2}']
    whitelistIgnoreAdminOnGroup: false
    whitelistIgnoreAdminOnFriend: false
    logLevel: debug
    typingCharsPerMinute: 6000
    typingMinSeconds: 1
    typingMaxSeconds: 1
    groupMinGapSeconds: 0
${GROUP_REPLY ? '    groupReplyMention: true\n    groupReplyQuote: true\n' : ''}`)

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
  imgServer.close()
  if (!process.env.E2E_KEEP) rmSync(home, { recursive: true, force: true })
}

// ---- 假 SnowLuma
const url = 'ws://127.0.0.1:' + WS_PORT + '/ws'
const headers = token => ({
  'X-Self-ID': String(BOT),
  'X-Client-Role': 'Universal',
  ...(token === undefined ? {} : { Authorization: 'Bearer ' + token }),
})
async function dial(token) {
  for (;;) {
    if (Date.now() > deadline) await fail('插件的 WS 一直没起来\n' + dshLog.slice(-4000))
    const result = await new Promise(resolve => {
      const ws = new WebSocket(url, { headers: headers(token) })
      ws.once('open', () => resolve({ ws }))
      ws.once('unexpected-response', (_req, res) => resolve({ status: res.statusCode }))
      ws.once('error', error => resolve({ error }))
    })
    if (result.error?.code === 'ECONNREFUSED') { await new Promise(r => setTimeout(r, 500)); continue }
    return result
  }
}

const noToken = await dial(undefined)
if (noToken.status !== 401) await fail('没带 Token 应该 401，实际 ' + JSON.stringify(noToken.status ?? noToken))
const badToken = await dial('wrong')
if (badToken.status !== 403) await fail('Token 错误应该 403，实际 ' + JSON.stringify(badToken.status ?? badToken))
log('Token 校验正常（401/403）')

const { ws } = await dial(TOKEN)
if (!ws) await fail('Token 正确却连不上')
log('已连接')

const calls = []
const sent = []
const history = new Map()
const forwards = new Map()
let nextMsgId = 1000
ws.on('message', raw => {
  const req = JSON.parse(String(raw))
  if (!req.action) return
  calls.push(req)
  let data = null
  if (req.action === 'send_private_msg' || req.action === 'send_group_msg') {
    sent.push(req)
    data = { message_id: nextMsgId++ }
  } else if (req.action === 'get_group_member_info') {
    data = { user_id: req.params.user_id, card: req.params.user_id === BOT ? '大肥鱼' : req.params.user_id === 556 ? '大肥鱼 FISH 群友' : '', nickname: 'nick' + req.params.user_id }
  } else if (req.action === 'get_stranger_info') {
    data = { user_id: req.params.user_id, nickname: '陌生人' + req.params.user_id }
  } else if (req.action === 'get_msg') {
    data = history.get(req.params.message_id) ?? history.get(Number(req.params.message_id ?? req.params.id)) ?? null
  } else if (req.action === 'get_forward_msg') {
    data = forwards.get(String(req.params.message_id ?? req.params.id)) ?? null
  } else if (req.action === 'get_login_info') {
    data = { user_id: BOT, nickname: '测试号' }
  }
  ws.send(JSON.stringify({ status: data === null && (req.action === 'get_msg' || req.action === 'get_forward_msg') ? 'failed' : 'ok', retcode: 0, data, echo: req.echo }))
})

const event = e => { ws.send(JSON.stringify({ time: Math.floor(Date.now() / 1000), self_id: BOT, ...e })); return e.message_id }
const privateMsg = (message, user = USER) => event({
  post_type: 'message', message_type: 'private', sub_type: 'friend', message_id: nextMsgId++, user_id: user,
  message, raw_message: '', font: 0, sender: { user_id: user, nickname: '主人' },
})
const groupMsg = (message, group = GROUP, user = USER) => event({
  post_type: 'message', message_type: 'group', sub_type: 'normal', message_id: nextMsgId++, group_id: group, user_id: user,
  message, raw_message: '', font: 0, sender: { user_id: user, nickname: '主人', card: '群名片' },
})
const text = t => ({ type: 'text', data: { text: t } })
const at = qq => ({ type: 'at', data: { qq: String(qq) } })

async function waitFor(pred, what, ms = 60_000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const hit = pred()
    if (hit) return hit
    await new Promise(r => setTimeout(r, 200))
  }
  await fail('等不到：' + what + '\n已发出：' + JSON.stringify(sent) + '\n模型收到：' + JSON.stringify(modelRequests) + '\n' + dshLog.slice(-3000))
}
const sentText = req => req.params.message.filter(s => s.type === 'text').map(s => s.data.text).join('')

// 1. 私聊：直接交给模型，send_private_msg 回复
privateMsg([text('  你好呀  ')])
const r1 = await waitFor(() => sent.find(s => s.action === 'send_private_msg'), '私聊回复')
if (r1.params.user_id !== USER) await fail('私聊回复发错人：' + JSON.stringify(r1.params))
if (sentText(r1) !== '回复:你好呀') await fail('私聊回复内容不对：' + sentText(r1))
if (!r1.params.self_id) await fail('私聊回复应带 self_id 路由：' + JSON.stringify(r1.params))
log('私聊 OK：' + sentText(r1))

// 2. 群里不 @：不交给模型
const before = modelRequests.length
groupMsg([text('大家好')])
await new Promise(r => setTimeout(r, 3000))
if (modelRequests.length !== before) await fail('群里没 @ 也交给了模型')
if (sent.some(s => s.action === 'send_group_msg')) await fail('群里没 @ 也回复了')
log('群里不 @ 不回 OK')

// 普通成员和私聊分别受对应名单限制；管理员另测默认豁免。
groupMsg([at(BOT), text('白名单外的艾特')], GROUP + 1, USER + 3)
groupMsg([text('大肥鱼，白名单外的关键词')], GROUP + 1, USER + 3)
groupMsg([text('/help')], GROUP + 1, USER + 3)
privateMsg([text('白名单外的普通私聊')], USER + 3)
privateMsg([text('/help')], USER + 3)
await new Promise(r => setTimeout(r, 1000))
if (modelRequests.length !== before || sent.some(s => s.params.group_id === GROUP + 1 || s.params.user_id === USER + 3)) await fail('普通用户绕过了群聊或私聊白名单')
log('普通群成员和私聊使用各自白名单 OK')

// 3. 群里 @ 机器人：唤醒；第一个 @ 机器人不进文字
const replyMessageId = groupMsg([at(BOT), text(' 在吗')])
const r3 = await waitFor(() => sent.find(s => s.action === 'send_group_msg'), '群 @ 回复')
if (r3.params.group_id !== GROUP) await fail('群回复发错群：' + JSON.stringify(r3.params))
if (sentText(r3).trimStart() !== '回复:[群名片(' + USER + ')] 在吗') await fail('群 @ 回复内容不对（应带发送者前缀）：' + sentText(r3))
if (!calls.some(c => c.action === 'get_group_member_info' && c.params.user_id === BOT)) await fail('@ 没有查群名片')
const replyHeaders = r3.params.message.filter(m => m.type === 'reply' || m.type === 'at')
if (GROUP_REPLY) {
  if (replyHeaders.map(m => m.type).join(',') !== 'reply,at' || String(replyHeaders[0].data.id) !== String(replyMessageId) || String(replyHeaders[1].data.qq) !== String(USER)) await fail('群回复引用或 @ 对象不正确：' + JSON.stringify({ replyHeaders, replyMessageId }))
} else if (replyHeaders.length) await fail('群回复 @ 和引用应默认关闭')
log('群回复 @ / 引用 ' + (GROUP_REPLY ? '开启' : '默认关闭') + ' OK')
log('群 @ OK（带发送者前缀）：' + sentText(r3))

// 3b. @别人时其昵称含唤醒词不能误触发；真正的正文关键词仍能唤醒。
const keywordRequestsBefore = modelRequests.length
const keywordSendsBefore = sent.length
groupMsg([at(556), text('你在吗')])
await new Promise(r => setTimeout(r, 1200))
if (modelRequests.length !== keywordRequestsBefore || sent.length !== keywordSendsBefore) await fail('@别人昵称含唤醒词误触发了回复')
groupMsg([at(556), text('大肥鱼也来看看')])
await waitFor(() => sent.length > keywordSendsBefore, '正文关键词唤醒')
if (!modelRequests.slice(keywordRequestsBefore).some(t => t.includes('@大肥鱼 FISH 群友(556)') && t.includes('大肥鱼也来看看'))) await fail('正文关键词或@对象信息丢失')
log('@别人昵称含唤醒词不误触发，正文关键词仍唤醒 OK')

// 4. 唤醒前缀 / 被去掉；@ 别人（名片为空）时查 get_stranger_info，文字里写成 @昵称(QQ)
const groupSentBefore = sent.filter(s => s.action === 'send_group_msg').length
groupMsg([text('/问一下'), at(555), text('是谁')])
const r4 = await waitFor(() => sent.filter(s => s.action === 'send_group_msg')[groupSentBefore], '唤醒前缀回复')
if (!modelRequests.some(t => t.includes('问一下 @陌生人555(555) 是谁'))) await fail('模型收到的文字不对：' + JSON.stringify(modelRequests.slice(-2)))
if (!calls.some(c => c.action === 'get_stranger_info' && c.params.user_id === 555)) await fail('名片为空时没查 get_stranger_info')
log('唤醒前缀 OK：' + sentText(r4))

// 5. 引用机器人的消息：get_msg 取回被引用消息，sender 是机器人 → 唤醒
history.set(4242, { message_id: 4242, message_type: 'group', group_id: GROUP, self_id: BOT, time: 1, sender: { user_id: BOT, nickname: '大肥鱼' }, message: [text('我是上一条')] })
const groupSentBefore5 = sent.filter(s => s.action === 'send_group_msg').length
groupMsg([{ type: 'reply', data: { id: '4242' } }, text('接着说')])
await waitFor(() => sent.filter(s => s.action === 'send_group_msg')[groupSentBefore5], '引用回复')
if (!calls.some(c => c.action === 'get_msg' && c.params.message_id === 4242)) await fail('引用没有调 get_msg')
log('引用机器人唤醒 OK')

// 6. 图片作为附件交给模型（私聊只发图片）
const before7 = modelRequests.length
privateMsg([{ type: 'image', data: { file: 'a.png', url: imgUrl, summary: '[图片]' } }])
await waitFor(() => modelRequests.length > before7, '带图片的私聊交给模型')
if (!modelImages.slice(before7).some(n => n > 0)) await fail('模型请求里没有图片块：' + JSON.stringify(modelImages) + '\n' + dshLog.slice(-3000))
log('图片交给模型 OK')

// 7. 同一条消息重复推送只处理一次
const before8 = modelRequests.length
const dupId = nextMsgId++
const dup = { post_type: 'message', message_type: 'private', sub_type: 'friend', message_id: dupId, user_id: USER, message: [text('只回一次')], raw_message: '', font: 0, sender: { user_id: USER, nickname: '主人' } }
event(dup)
event(dup)
await waitFor(() => modelRequests.length > before8, '去重后的消息交给模型')
await new Promise(r => setTimeout(r, 3000))
if (modelRequests.slice(before8).filter(t => t === '只回一次').length !== 1) await fail('重复消息被处理了多次：' + JSON.stringify(modelRequests.slice(before8)))
log('去重 OK')

// 8. 通知（私聊戳一戳）不交给模型
const before9 = modelRequests.length
event({ post_type: 'notice', notice_type: 'notify', sub_type: 'poke', user_id: USER, target_id: BOT })
await new Promise(r => setTimeout(r, 3000))
if (modelRequests.length !== before9) await fail('通知被交给了模型')
log('通知不交给模型 OK')

// 9. 引用聊天记录：模型收到 <Quoted Message>，记录里套着的记录也展开
forwards.set('F1', { messages: [{ sender: { nickname: '甲' }, message: [text('第一层')] }, { sender: { nickname: '乙' }, message: [{ type: 'forward', data: { id: 'F2' } }] }] })
forwards.set('F2', { messages: [{ sender: { nickname: '丙' }, message: [text('第二层')] }] })
history.set(5151, { message_id: 5151, message_type: 'private', self_id: BOT, time: 1, sender: { user_id: USER, nickname: '主人' }, message: [{ type: 'forward', data: { id: 'F1' } }] })
const before10 = modelFull.length
privateMsg([{ type: 'reply', data: { id: '5151' } }, text('总结一下')])
await waitFor(() => modelFull.length > before10, '引用聊天记录交给模型')
const quotedSeen = modelFull.slice(before10).join('\n')
if (!quotedSeen.includes('<Quoted Message>') || !quotedSeen.includes('甲: 第一层') || !quotedSeen.includes('丙: 第二层')) await fail('模型没看到引用的聊天记录：' + quotedSeen.slice(0, 600))
log('引用聊天记录展开 OK')

// 10. 测试连接接口：要先登录 dsh；SnowLuma 已连上时返回 QQ 号
const tokenUrl = (dshLog.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+/) ?? [])[0]
if (!tokenUrl) await fail('dsh 日志里找不到登录网址')
const webBase = tokenUrl.slice(0, tokenUrl.indexOf('?'))
const anon = await fetch(webBase + 'api/snowluma-bridge/status')
if (anon.status !== 401) await fail('没登录也能访问状态接口：' + anon.status)
const login = await fetch(tokenUrl, { redirect: 'manual' })
const cookie = (login.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0]).join('; ')
const statusRes = await fetch(webBase + 'api/snowluma-bridge/status', { headers: { cookie } })
const st = statusRes.ok ? await statusRes.json() : null
if (!st || !st.listening || st.connections.length < 1 || st.login?.user_id !== BOT || st.tokenSet !== true) await fail('状态接口返回不对：' + statusRes.status + ' ' + JSON.stringify(st))
if (JSON.stringify(st).includes(TOKEN)) await fail('状态接口泄露了 Token')
log('测试连接接口 OK（需登录、返回 QQ 号、不含 Token）')

// 11. 默认把当前时间和群名写进 <system_reminder>
if (!modelFull.some(t => /<system_reminder>[\s\S]*Current datetime: \d{4}-\d{2}-\d{2}/.test(t))) await fail('模型没收到当前时间：' + modelFull.slice(-1)[0]?.slice(0, 400))
log('当前时间提示 OK')

// 12. QQ 管家的消息被忽略
const before6 = modelRequests.length
privateMsg([text('管家消息')], 2854196310)
await new Promise(r => setTimeout(r, 3000))
if (modelRequests.length !== before6) await fail('QQ 管家的消息被交给了模型')
log('QQ 管家屏蔽 OK')

// 13. 视频：文字里写 [视频]（测试环境没有 ffmpeg，或视频取不到时都是这样），不会被丢掉
const before13 = modelRequests.length
privateMsg([{ type: 'video', data: { file: 'v.mp4', url: 'http://127.0.0.1:9/none.mp4' } }])
await waitFor(() => modelRequests.length > before13, '视频消息交给模型')
if (modelRequests.slice(before13)[0] !== '[视频]') await fail('视频消息模型收到的不对：' + JSON.stringify(modelRequests.slice(before13)))
log('视频占位 OK')

// 13b. 语音转文字的测试按钮：要先登录；测试环境里关着，就说关着
const anonStt = await fetch(webBase + 'api/snowluma-bridge/stt/test', { method: 'POST' })
if (anonStt.status !== 401) await fail('没登录也能访问语音测试接口：' + anonStt.status)
const sttRes = await fetch(webBase + 'api/snowluma-bridge/stt/test', { method: 'POST', headers: { cookie } })
const sttJson = sttRes.ok ? await sttRes.json() : null
if (!sttJson || sttJson.ok !== false || sttJson.error !== '语音转文字关着') await fail('语音测试接口返回不对：' + sttRes.status + ' ' + JSON.stringify(sttJson))
log('语音转文字测试接口 OK（需登录）')

// 13c. 文字转语音：状态和试听接口要登录；没填 Key 时试听说没填，不会真的去请求外面
const anonTts = await fetch(webBase + 'api/snowluma-bridge/tts/status')
if (anonTts.status !== 401) await fail('没登录也能访问文字转语音状态接口：' + anonTts.status)
const ttsSt = await (await fetch(webBase + 'api/snowluma-bridge/tts/status', { headers: { cookie } })).json()
if (!ttsSt.today || ttsSt.today.breeze !== 0 || ttsSt.lastFallback !== undefined) await fail('文字转语音状态不对：' + JSON.stringify(ttsSt))
const ttsTest = await (await fetch(webBase + 'api/snowluma-bridge/tts/test', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'inworld' }) })).json()
if (ttsTest.ok !== false || !/还没填 Inworld 的 Key/.test(ttsTest.error)) await fail('文字转语音试听接口返回不对：' + JSON.stringify(ttsTest))
log('文字转语音接口 OK（需登录、没填 Key 时说没填）')

// 14. ffmpeg 状态接口：要先登录；返回有没有 ffmpeg、能不能一键安装
const anonFf = await fetch(webBase + 'api/snowluma-bridge/ffmpeg')
if (anonFf.status !== 401) await fail('没登录也能访问 ffmpeg 接口：' + anonFf.status)
const ffRes = await fetch(webBase + 'api/snowluma-bridge/ffmpeg', { headers: { cookie } })
const ff = ffRes.ok ? await ffRes.json() : null
if (!ff || !('found' in ff) || typeof ff.installSupported !== 'boolean' || ff.install?.state !== 'idle') await fail('ffmpeg 状态接口返回不对：' + ffRes.status + ' ' + JSON.stringify(ff))
log('ffmpeg 状态接口 OK（' + (ff.found ? '找到 ' + ff.found.version : '没找到') + '）')

// 15. 掉线检测：要先登录；假 SnowLuma 连着、小号在线时是 ok；没设置提醒渠道时测试按钮说清楚
const anonWatch = await fetch(webBase + 'api/snowluma-bridge/watch')
if (anonWatch.status !== 401) await fail('没登录也能访问掉线检测接口：' + anonWatch.status)
const watch = await (await fetch(webBase + 'api/snowluma-bridge/watch?fresh=1', { headers: { cookie } })).json()
if (watch.state !== 'ok' || watch.account?.userId !== String(BOT)) await fail('掉线检测状态不对：' + JSON.stringify(watch))
const alertTest = await (await fetch(webBase + 'api/snowluma-bridge/alert/test', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ channel: 'mail' }) })).json()
if (alertTest.ok !== false || !String(alertTest.results).includes('还没填')) await fail('提醒测试接口返回不对：' + JSON.stringify(alertTest))
// 测试按钮带上页面上还没保存的值：选了 Server酱 但没填 Key，应该说「还没填 Key」而不是「没有选推送服务」
const pushForm = await (await fetch(webBase + 'api/snowluma-bridge/alert/test', { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ channel: 'push', form: { pushService: 'serverchan', pushKey: '' } }) })).json()
if (pushForm.ok !== false || !String(pushForm.results).includes('还没填 Key')) await fail('提醒测试没用页面上的值：' + JSON.stringify(pushForm))
log('掉线检测、提醒测试接口 OK')

// 16. 她一轮什么都没说出来（话只写在思考里）：自动提醒她一次，她再说一遍就发出去；同一条消息只提醒一次
const privBefore16 = sent.filter(s => s.action === 'send_private_msg').length
const reqBefore16 = modelRequests.length
privateMsg([text('THINK-ONLY 你在吗')])
await waitFor(() => sent.filter(s => s.action === 'send_private_msg').slice(privBefore16).find(s => sentText(s).includes('你刚才这一轮只在心里想了')), '只想没说之后的补说')
await new Promise(r => setTimeout(r, 1500))
if (sent.filter(s => s.action === 'send_private_msg').slice(privBefore16).some(s => sentText(s).includes('THINK-ONLY'))) await fail('不该把思考里的东西发出去')
if (modelRequests.length - reqBefore16 !== 2) await fail('应该正好多调一次模型（原来一次 + 提醒一次），实际 ' + (modelRequests.length - reqBefore16))
log('只想没说时提醒一次 OK')

// 17. 两份名单独立迁移，管理员在名单之外也能私聊和群聊；普通人不能继承管理员权限。
privateMsg([text('管理员默认豁免私聊')], USER + 1)
await waitFor(() => sent.find(s => s.params.user_id === USER + 1 && sentText(s).includes('管理员默认豁免私聊')), '管理员私聊默认豁免')
groupMsg([at(BOT), text('管理员默认豁免群聊')], GROUP + 1, USER + 1)
await waitFor(() => sent.find(s => s.params.group_id === GROUP + 1 && sentText(s).includes('管理员默认豁免群聊')), '管理员群内默认豁免')
privateMsg([text('迁移后的普通私聊白名单')], USER + 2)
await waitFor(() => sent.find(s => s.params.user_id === USER + 2 && sentText(s).includes('迁移后的普通私聊白名单')), '旧私聊标识迁入独立名单')
const afterAdmin = modelRequests.length
const sentAfterAdmin = sent.length
groupMsg([at(BOT), text('不能继承管理员豁免')], GROUP + 1, USER + 3)
await new Promise(r => setTimeout(r, 1000))
if (modelRequests.length !== afterAdmin || sent.length !== sentAfterAdmin) await fail('普通群成员继承了管理员豁免')
log('管理员私聊/群聊默认豁免、旧名单迁移、普通人不继承权限 OK')

log('全部通过')
if (process.env.E2E_HOLD) {
  // 保留 dsh 和假 SnowLuma，方便在浏览器里看设置页；Ctrl-C 结束
  log('保留运行中，dsh 网页：http://127.0.0.1:' + (process.env.E2E_WEB_PORT ?? '?') + '/')
  await new Promise(() => {})
}
ws.close()
await cleanup()
process.exit(0)
