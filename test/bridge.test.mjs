// 单元测试：桥接（白名单、管理员、指令、只 @ 等待、频率限制、提示、按类型选预设、语音转文字、
// 给其他插件的接口：napcat/prompt、会话信息、换会话、napcat/sent，视频截图）。
// 用法：node --test test/（先 pnpm run build）
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { AiocqhttpAdapter } from '../lib/adapter.js'
import { Bridge, formatNow, legacyWhitelistFor } from '../lib/bridge.js'
import { Media } from '../lib/media.js'
import { SessionStore } from '../lib/store.js'

const BOT = 10001
const ADMIN = '42'

function settings(over = {}) {
  return {
    cwd: '/tmp',
    wake: { wakePrefix: ['/'], ignoreBotSelfMessage: false, friendMessageNeedsWakePrefix: false },
    identifier: true, imageToModel: false, maxImages: 0,
    admins: [ADMIN],
    whitelist: { enabled: false, ids: [], ignoreAdminOnGroup: true, ignoreAdminOnFriend: true, log: false },
    rateLimit: { count: 0, seconds: 60, strategy: 'stall' },
    emptyMention: { waiting: true, needReply: true },
    uniqueSession: false,
    reminder: { datetime: false, timezone: 'Asia/Shanghai', groupName: false, markAdmin: false },
    commands: { enabled: true, noPermissionReply: true },
    presets: { default: '', private: '', group: '', adminPrivate: '' },
    models: { private: '', group: '', adminPrivate: '' },
    reasoning: { private: 'low', group: 'low', adminPrivate: 'high' },
    stt: { mode: 'off', command: '', apiUrl: '', apiKey: '', model: '' },
    video: { enabled: true, maxFrames: 4, secondsPerFrame: 5, maxEdge: 1024, maxMB: 100, maxMinutes: 10, timeoutSeconds: 30, ffmpegPath: '/nonexistent/ffmpeg' },
    silenceToken: '[不发]',
    segment: { adminPrivate: false, private: false, group: false, maxSegments: 10, maxSecondsPerSegment: 3 },
    pace: { typingPrivate: false, typingGroup: false, charsPerMinute: 0, typingMinSeconds: 0, typingMaxSeconds: 0, groupMinGapSeconds: 0, groupMaxPerWindow: 0, groupWindowSeconds: 60, maxWaitSeconds: 120 },
    tts: { enabled: false, mode: 'tag', chance: 30, adminPrivate: true, private: false, group: false, maxChars: 150, alsoText: false, stripParens: true, speed: 100, timezone: 'Asia/Shanghai', breeze: { key: '', voiceId: '', model: '', language: '' }, inworld: { key: '', voiceId: '', model: '' } },
    ...over,
    whitelist: { enabled: false, log: false, ...over.whitelist,
      groupIds: over.whitelist?.groupIds ?? over.whitelist?.ids ?? [],
      privateIds: over.whitelist?.privateIds ?? over.whitelist?.ids ?? [],
    },
  }
}

/** 搭一个桥：假的 agent 注册表记下每次 followup，假的 NapCat 记下发出的消息。 */
function harness(over = {}, api = {}, hooks = {}) {
  const followups = []
  const created = []
  const sent = []
  const events = { prompt: [], sent: [], changed: [] }
  let sessionListener = () => {}
  let s = settings(over)
  const agents = {
    create: async opts => {
      created.push(opts)
      const sessionId = String(opts.sessionId)
      return {
        agent: {
          session: { id: sessionId },
          followup: m => followups.push({ sessionId, text: m.content.map(c => c.text ?? '').filter(t => t !== '').join('\n'), images: m.content.filter(c => c.type === 'image').length }),
          cancel: () => followups.push({ sessionId, cancelled: true }),
        },
        dispose: async () => {},
      }
    },
    resume: async () => { throw new Error('不该恢复') },
    get: id => hooks.live?.[String(id)],
  }
  let bridge
  const adapter = new AiocqhttpAdapter({ id: 'napcat', ws_reverse_host: '127.0.0.1', ws_reverse_port: 0, log: () => {}, onMessage: (abm, ev) => bridge.handle(abm, ev) })
  adapter.bot.callAction = async (action, params) => {
    if (action === 'send_private_msg' || action === 'send_group_msg') {
      sent.push({ action, text: params.message.map(m => m.type === 'record' ? '[语音:' + Buffer.from(String(m.data.file).replace('base64://', ''), 'base64').toString() + ']' : m.data.text ?? '').join('') })
      return { message_id: 1 }
    }
    if (action in api) return api[action](params)
    throw new Error('unexpected ' + action)
  }
  adapter.bot.sendPrivateMsg = p => adapter.bot.callAction('send_private_msg', p)
  adapter.bot.sendGroupMsg = p => adapter.bot.callAction('send_group_msg', p)
  const media = new Media({
    callAction: (a, p) => adapter.bot.callAction(a, p),
    attachments: () => hooks.attachments,
    settings: () => ({ imageToModel: s.imageToModel, maxImages: s.maxImages, stt: s.stt, video: s.video }),
    log: () => {},
  })
  bridge = new Bridge({
    agents,
    defaultModel: () => ({ currentSelection: () => ({ provider: 'deepseek', model: 'default-model' }) }),
    presets: () => ({ mount: async () => ({}), defaultId: hooks.defaultPreset }),
    persistence: () => undefined,
    media,
    callAction: (a, p) => adapter.bot.callAction(a, p),
    onSessionEvent: listener => { sessionListener = listener; return () => {} },
    emit: () => {},
    prompt: async payload => { events.prompt.push(payload); if (hooks.prompt) await hooks.prompt(payload) },
    sent: payload => events.sent.push(payload),
    sessionChanged: change => events.changed.push(change),
    sendBySession: (session, chain) => adapter.sendBySession(session, chain),
    selfId: () => String(BOT),
    settings: () => s,
    store: new SessionStore(join(mkdtempSync(join(tmpdir(), 'napcat-store-')), 'sessions.json')),
    log: () => {},
    tts: hooks.tts,
    sleep: hooks.sleep,
  })
  let id = 100
  const send = async (ev) => {
    const abm = await adapter.convertMessage({ self_id: BOT, time: 1700000000, message_id: id++, ...ev })
    if (abm) await bridge.handle(abm, adapter.createEvent(abm))
  }
  const privateMsg = (user, message) => send({ post_type: 'message', message_type: 'private', user_id: user, sender: { user_id: user, nickname: 'n' + user }, message })
  const groupMsg = (user, group, message, role = 'member') => send({ post_type: 'message', message_type: 'group', group_id: group, group_name: '测试群', user_id: user, sender: { user_id: user, nickname: 'n' + user, card: '', role }, message })
  const turn = (sessionId, reply) => {
    const session = { id: sessionId }
    sessionListener(session, { type: 'turn/start' })
    sessionListener(session, { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: reply }] } } })
    sessionListener(session, { type: 'turn/end' })
  }
  const startTurn = sessionId => sessionListener({ id: sessionId }, { type: 'turn/start' })
  return { followups, created, sent, events, bridge, turn, startTurn, privateMsg, groupMsg, set: next => { s = settings({ ...over, ...next }) } }
}
const text = t => ({ type: 'text', data: { text: t } })
const at = qq => ({ type: 'at', data: { qq: String(qq) } })
const memberInfo = { get_group_member_info: p => ({ card: p.user_id === BOT ? '鱼' : '' }), get_stranger_info: () => ({ nickname: '路人' }) }

test('白名单：普通群聊和私聊受限；管理员默认豁免，不需要开关', async () => {
  const h = harness({ whitelist: { enabled: true, ids: ['555', '77'], ignoreAdminOnGroup: true, ignoreAdminOnFriend: true, log: false } }, memberInfo)
  await h.groupMsg(9, 666, [at(BOT), text('不在名单')])
  await h.privateMsg(8, [text('不在名单')])
  assert.equal(h.followups.length, 0)
  await h.groupMsg(9, 555, [at(BOT), text('在名单的群')])
  await h.privateMsg(77, [text('在名单的私聊')])
  await h.privateMsg(Number(ADMIN), [text('管理员私聊')])
  await h.groupMsg(Number(ADMIN), 666, [at(BOT), text('管理员在别的群')])
  assert.equal(h.followups.length, 4)
})

test('白名单关闭时不检查', async () => {
  const h = harness({}, memberInfo)
  await h.privateMsg(8, [text('谁都行')])
  assert.equal(h.followups.length, 1)
})

test('普通群成员的关键词、@、引用和指令都受限；管理员发言不受限', async () => {
  const h = harness({
    wake: { wakePrefix: ['/'], wakeKeywords: ['大肥鱼'] },
    whitelist: { enabled: true, ids: ['555'], ignoreAdminOnGroup: true, ignoreAdminOnFriend: true },
  }, { ...memberInfo, get_msg: () => ({ sender: { user_id: BOT }, message: [text('上一句')] }) })
  for (const user of [9]) {
    for (const message of [[text('大肥鱼在吗')], [at(BOT), text('在吗')], [{ type: 'reply', data: { id: '1' } }, text('继续')], [text('/help')], [at(BOT)]]) {
      await h.groupMsg(user, 666, message)
    }
  }
  assert.equal(h.followups.length, 0)
  assert.equal(h.created.length, 0)
  assert.equal(h.sent.length, 0)
  await h.groupMsg(Number(ADMIN), 666, [at(BOT), text('管理员在名单外的群也允许')])
  await h.groupMsg(9, 555, [at(BOT), text('允许')])
  assert.equal(h.followups.length, 2)
})

test('白名单清空时普通群聊和私聊全部禁用；完整会话标识也能放行', async () => {
  const wl = { enabled: true, ids: [], ignoreAdminOnGroup: true, ignoreAdminOnFriend: true }
  const h = harness({ whitelist: wl }, memberInfo)
  await h.groupMsg(9, 555, [at(BOT), text('不能回')])
  assert.equal(h.followups.length, 0)
  await h.privateMsg(8, [text('普通私聊不能回')])
  assert.equal(h.followups.length, 0)
  h.set({ whitelist: { ...wl, ids: ['napcat:GroupMessage:555'] }, uniqueSession: true })
  await h.groupMsg(9, 555, [at(BOT), text('按完整标识放行')])
  assert.equal(h.followups.length, 1)
  h.set({ whitelist: { ...wl, ids: ['napcat:FriendMessage:77'] } })
  await h.privateMsg(77, [text('完整私聊标识放行')])
  assert.equal(h.followups.length, 2)
})

test('移出白名单后：主动唤醒、插件代发和已经生成的回复都不能发到群里', async () => {
  const wl = { enabled: true, ids: ['555'], ignoreAdminOnGroup: true, ignoreAdminOnFriend: true }
  const h = harness({ whitelist: wl }, memberInfo)
  await h.groupMsg(9, 555, [at(BOT), text('先聊一次')])
  const id = String(h.created[0].sessionId)
  h.set({ whitelist: { ...wl, ids: [] } })
  await assert.rejects(h.bridge.wake('napcat:GroupMessage:555', '看看群里'), /白名单/)
  await assert.rejects(h.bridge.sendBySession({ platform_name: 'napcat', message_type: 'GroupMessage', session_id: '555' }, { chain: [{ type: 'Plain', text: '代发' }] }), /白名单/)
  h.turn(id, '已经生成但不该发的回复')
  await new Promise(r => setTimeout(r, 20))
  assert.equal(h.sent.length, 0)
  assert.equal(h.events.sent.length, 0)
  assert.equal(h.followups.length, 1)
})

test('排队等打字时移出群白名单：待发消息丢弃，不广播已发送事件', async () => {
  let release, started
  const waiting = new Promise(r => { started = r })
  const wl = { enabled: true, ids: ['555'], ignoreAdminOnGroup: true, ignoreAdminOnFriend: true }
  const h = harness({ whitelist: wl, pace: { ...settings().pace, typingGroup: true, charsPerMinute: 60, typingMinSeconds: 1, typingMaxSeconds: 1 } }, memberInfo, {
    sleep: () => new Promise(r => { release = r; started() }),
  })
  await h.groupMsg(9, 555, [at(BOT), text('在吗')])
  h.turn(String(h.created[0].sessionId), '排队的回复')
  await waiting
  h.set({ whitelist: { ...wl, ids: [] } })
  release()
  await new Promise(r => setTimeout(r, 20))
  assert.equal(h.sent.length, 0)
  assert.equal(h.events.sent.length, 0)
})

test('媒体和提示扩展处理期间移出白名单：不再交给模型', async () => {
  const wl = { enabled: true, ids: ['555'], ignoreAdminOnGroup: true, ignoreAdminOnFriend: true }
  let h
  h = harness({ whitelist: wl }, memberInfo, { prompt: () => h.set({ whitelist: { ...wl, ids: [] } }) })
  await h.groupMsg(9, 555, [at(BOT), text('在吗')])
  assert.equal(h.followups.length, 0)
})

test('指令：/help /sid 回复，不交给模型；/new 换新会话', async () => {
  const h = harness({}, memberInfo)
  await h.privateMsg(8, [text('你好')])
  await h.privateMsg(8, [text('/help')])
  await h.privateMsg(8, [text('/sid')])
  assert.equal(h.followups.length, 1)
  assert.match(h.sent[0].text, /可用指令/)
  assert.match(h.sent[1].text, /会话标识：napcat:FriendMessage:8/)
  await h.privateMsg(8, [text('/new')])
  assert.match(h.sent[2].text, /新的对话/)
  await h.privateMsg(8, [text('再说一句')])
  assert.equal(h.created.length, 2)
  assert.notEqual(String(h.created[0].sessionId), String(h.created[1].sessionId))
})

test('指令：群里 /new 只有管理员、群主、群管理能用', async () => {
  const h = harness({}, memberInfo)
  await h.groupMsg(9, 555, [text('/new')])
  assert.match(h.sent.at(-1).text, /只有管理员/)
  await h.groupMsg(9, 555, [text('/new')], 'admin')
  assert.match(h.sent.at(-1).text, /新的对话/)
})

test('只 @ 她不说话：先让她问一句，这个人 60 秒内的下一条算唤醒', async () => {
  const h = harness({}, memberInfo)
  await h.groupMsg(9, 555, [at(BOT)])
  assert.equal(h.followups.length, 1)
  assert.match(h.followups[0].text, /只是通过@来唤醒你/)
  await h.groupMsg(9, 555, [text('帮我看看这个')])
  assert.equal(h.followups.length, 2)
  assert.match(h.followups[1].text, /帮我看看这个/)
  await h.groupMsg(9, 555, [text('这条不 @ 不该唤醒')])
  assert.equal(h.followups.length, 2)
})

test('频率限制：丢弃模式超出后不交给模型', async () => {
  const h = harness({ rateLimit: { count: 2, seconds: 60, strategy: 'discard' } }, memberInfo)
  for (let i = 0; i < 4; i += 1) await h.privateMsg(8, [text('第' + i + '条')])
  assert.equal(h.followups.length, 2)
})

test('提示：时间、群名、管理员身份写进 <system_reminder>', async () => {
  const h = harness({ reminder: { datetime: true, timezone: 'Asia/Shanghai', groupName: true, markAdmin: true } }, memberInfo)
  await h.groupMsg(Number(ADMIN), 555, [at(BOT), text('几点了')])
  const t = h.followups[0].text
  assert.match(t, /<system_reminder>Sender role: admin \(QQ 42\)\nGroup name: 测试群\nCurrent datetime: \d{4}-\d{2}-\d{2} \d{2}:\d{2} \(.+\), Weekday: \w+day<\/system_reminder>/)
})

test('提示：群里被 @ 或引用叫醒时告诉她「这条是在叫你」和她的 QQ 号、群名片；私聊、关掉时不写', async () => {
  const R = { datetime: false, timezone: 'Asia/Shanghai', groupName: false, markAdmin: false, markWake: true }
  const h = harness({ reminder: R }, memberInfo)
  await h.groupMsg(7, 555, [at(BOT), at(8), text('形容一下这个表情包')])
  const t = h.followups[0].text
  assert.match(t, /@路人\(8\)/, '别人的 @ 还在文字里')
  assert.match(t, /<system_reminder>这条消息@ 了你，是在叫你。你在这个群里的 QQ 号是 10001，群名片「鱼」。叫你的那个 @ 已经从文字里去掉了/)
  await h.groupMsg(7, 555, [text('/在吗')])
  assert.doesNotMatch(h.followups[1].text, /是在叫你/, '唤醒前缀叫醒的不写')
  await h.privateMsg(8, [text('你好')])
  assert.doesNotMatch(h.followups[2].text, /是在叫你/)
  h.set({ reminder: { ...R, markWake: false } })
  await h.groupMsg(7, 556, [at(BOT), text('在吗')])
  assert.doesNotMatch(h.followups[3].text, /是在叫你/)
})

test('时间格式', () => {
  assert.equal(formatNow('Asia/Shanghai', new Date('2026-10-23T13:40:00Z')), '2026-10-23 21:40 (GMT+8), Weekday: Friday')
})

test('按聊天类型选预设和模型：管理员私聊 > 私聊/群聊 > 默认', async () => {
  const h = harness({
    presets: { default: 'base', private: '', group: 'group-p', adminPrivate: 'owner-p' },
    models: { private: '', group: 'deepseek/flash-low', adminPrivate: '' },
  }, memberInfo)
  await h.privateMsg(Number(ADMIN), [text('主人')])
  await h.privateMsg(8, [text('别人私聊')])
  await h.groupMsg(9, 555, [at(BOT), text('群里')])
  assert.deepEqual(h.created.map(c => c.meta.agentPreset), ['owner-p', 'base', 'group-p'])
  assert.deepEqual(h.created.map(c => c.agentOptions.model), ['default-model', 'default-model', 'flash-low'])
})

test('没设预设时用 dsh 当前的默认预设（比如插件二设的「陪伴模式」）', async () => {
  const h = harness({}, memberInfo, { defaultPreset: 'companion' })
  await h.privateMsg(Number(ADMIN), [text('主人')])
  await h.groupMsg(9, 555, [at(BOT), text('群里')])
  assert.deepEqual(h.created.map(c => c.meta.agentPreset), ['companion', 'companion'])
  assert.ok(h.created.every(c => typeof c.setup === 'function'), '会挂上预设')
  const h2 = harness({ presets: { default: '', private: '', group: 'group-p', adminPrivate: '' } }, memberInfo, { defaultPreset: 'companion' })
  await h2.groupMsg(9, 555, [at(BOT), text('群里')])
  assert.equal(h2.created[0].meta.agentPreset, 'group-p', '设了的优先')
})

test('思考等级：主人私聊 high，其他私聊和群 low；设置改了，下一条消息时用新设置接回同一个会话（正在回复时不换）', async () => {
  const h = harness({}, memberInfo)
  await h.privateMsg(Number(ADMIN), [text('主人')])
  await h.privateMsg(8, [text('别人私聊')])
  await h.groupMsg(9, 555, [at(BOT), text('群里')])
  assert.deepEqual(h.created.map(c => c.agentOptions.reasoningEffort), ['high', 'low', 'low'])
  const ownerId = String(h.created[0].sessionId)
  // 设置没变：同一个连接接着用
  await h.privateMsg(Number(ADMIN), [text('再说一句')])
  assert.equal(h.created.length, 3)
  // 改成 max：下一条消息时换成新设置，会话 id 不变
  h.set({ reasoning: { private: 'low', group: 'low', adminPrivate: 'max' } })
  await h.privateMsg(Number(ADMIN), [text('换了吗')])
  assert.equal(h.created.length, 4)
  assert.equal(String(h.created[3].sessionId), ownerId)
  assert.equal(h.created[3].agentOptions.reasoningEffort, 'max')
  // 正在回复时改设置：先不换，等说完以后的下一条再换
  h.startTurn(ownerId)
  h.set({ reasoning: { private: 'low', group: 'low', adminPrivate: 'off' } })
  await h.privateMsg(Number(ADMIN), [text('她还在回复时来的')])
  assert.equal(h.created.length, 4, '正在回复，不换')
  h.turn(ownerId, '说完了')
  await h.privateMsg(Number(ADMIN), [text('说完以后')])
  assert.equal(h.created.length, 5)
  assert.equal(h.created[4].agentOptions.reasoningEffort, 'off')
})

test('唤醒词：群里提到「大肥鱼」不用 @ 也唤醒（英文不分大小写）；没提到不唤醒；私聊照常', async () => {
  const h = harness({ wake: { wakePrefix: ['/'], wakeKeywords: ['大肥鱼', 'Fish'], ignoreBotSelfMessage: false, friendMessageNeedsWakePrefix: false } }, memberInfo)
  await h.groupMsg(9, 555, [text('今天谁看到大肥鱼了')])
  await h.groupMsg(9, 555, [text('这条跟她没关系')])
  await h.groupMsg(9, 555, [text('hello FISH')])
  assert.equal(h.followups.length, 2)
  assert.match(h.followups[0].text, /今天谁看到大肥鱼了/)
  assert.match(h.followups[1].text, /hello FISH/)
})

test('群里每人单独会话', async () => {
  const h = harness({ uniqueSession: true }, memberInfo)
  await h.groupMsg(9, 555, [at(BOT), text('a')])
  await h.groupMsg(10, 555, [at(BOT), text('b')])
  assert.equal(new Set(h.created.map(c => String(c.sessionId))).size, 2)
  assert.match(String(h.created[0].sessionId), /9-555/)
})

test('语音：关闭时写 [语音]；本机命令方式转成文字', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'stt-'))
  const script = join(dir, 'fake-stt.sh')
  writeFileSync(script, '#!/bin/sh\necho "今天吃什么"\n')
  chmodSync(script, 0o755)
  const api = { ...memberInfo, get_record: () => ({ base64: Buffer.from('RIFFfake').toString('base64') }) }
  const h = harness({}, api)
  await h.privateMsg(8, [{ type: 'record', data: { file: 'a.amr' } }])
  assert.equal(h.followups[0].text, '[语音]')
  h.set({ stt: { mode: 'command', command: script + ' {file}', apiUrl: '', apiKey: '', model: '' } })
  await h.privateMsg(8, [{ type: 'record', data: { file: 'b.amr' } }])
  assert.equal(h.followups[1].text, '[语音] 今天吃什么')
})

test('napcat/prompt：其他插件能往内容里加东西，能拿到会话信息，第一轮标成新会话', async () => {
  const h = harness({}, memberInfo, {
    prompt: payload => { payload.content.unshift({ type: 'text', text: '<记忆>主人爱吃红烧肉</记忆>' }) },
  })
  await h.privateMsg(Number(ADMIN), [text('今天吃什么')])
  await h.privateMsg(Number(ADMIN), [text('再说一句')])
  assert.equal(h.followups[0].text, '<记忆>主人爱吃红烧肉</记忆>\n今天吃什么')
  const [first, second] = h.events.prompt
  assert.equal(first.newSession, true)
  assert.equal(second.newSession, false)
  assert.equal(first.message.message_str, '今天吃什么')
  assert.deepEqual(
    { type: first.info.type, userId: first.info.userId, adminPrivate: first.info.adminPrivate, umo: first.info.umo, selfId: first.info.selfId },
    { type: 'private', userId: ADMIN, adminPrivate: true, umo: 'napcat:FriendMessage:' + ADMIN, selfId: String(BOT) },
  )
})

test('napcat/prompt 监听器出错时照常交给模型', async () => {
  const h = harness({}, memberInfo, { prompt: () => { throw new Error('坏了') } })
  await h.privateMsg(8, [text('你好')])
  assert.equal(h.followups[0].text, '你好')
})

test('会话信息：建会话前登记，群聊有群号，群里每人单独会话时有 QQ 号', async () => {
  const h = harness({}, memberInfo)
  await h.groupMsg(9, 555, [at(BOT), text('a')])
  const id = String(h.created[0].sessionId)
  const info = h.bridge.sessionInfo(id)
  assert.equal(info.type, 'group')
  assert.equal(info.groupId, '555')
  assert.equal(info.userId, undefined)
  assert.equal(info.adminPrivate, false)
  assert.equal(h.bridge.sessionInfoByUmo('napcat:GroupMessage:555').sessionId, id)
  assert.equal(h.bridge.sessionInfo('不存在'), undefined)
  h.set({ uniqueSession: true })
  await h.groupMsg(10, 555, [at(BOT), text('b')])
  const unique = h.bridge.sessionInfo(String(h.created[1].sessionId))
  assert.equal(unique.userId, '10')
  assert.equal(unique.groupId, '555')
})

test('rotateSession：换新的 dsh 会话，发 napcat/session-changed，下一条进新会话并标成新会话', async () => {
  const h = harness({}, memberInfo)
  await h.privateMsg(8, [text('第一句')])
  const oldId = String(h.created[0].sessionId)
  const r = await h.bridge.rotateSession('napcat:FriendMessage:8')
  assert.equal(r.oldSessionId, oldId)
  assert.notEqual(r.newSessionId, oldId)
  assert.deepEqual(h.events.changed, [{ umo: 'napcat:FriendMessage:8', oldSessionId: oldId, newSessionId: r.newSessionId, reason: 'rotate' }])
  await h.privateMsg(8, [text('第二句')])
  assert.equal(String(h.created[1].sessionId), r.newSessionId)
  assert.equal(h.events.prompt[1].newSession, true)
  await h.privateMsg(8, [text('/new')])
  assert.equal(h.events.changed[1].reason, 'command')
})

test('分段发送：主人私聊按行拆成几条、按顺序发，每条都通知；别人私聊不拆', async () => {
  const h = harness({ segment: { adminPrivate: true, private: false, group: false, maxSegments: 3, maxSecondsPerSegment: 3 } }, memberInfo)
  await h.privateMsg(Number(ADMIN), [text('在吗')])
  h.turn(String(h.created[0].sessionId), '在的\n\n刚刚在摸鱼\n想你了\n真的')
  await new Promise(r => setTimeout(r, 30))
  assert.deepEqual(h.sent.map(m => m.text), ['在的', '刚刚在摸鱼', '想你了\n真的'], '最多 3 条，多的并进最后一条')
  assert.deepEqual(h.events.sent.map(e => e.text), ['在的', '刚刚在摸鱼', '想你了\n真的'])
  await h.privateMsg(8, [text('你好')])
  h.turn(String(h.created[1].sessionId), '你好呀\n我是大肥鱼')
  await new Promise(r => setTimeout(r, 30))
  assert.equal(h.sent.at(-1).text, '你好呀\n我是大肥鱼')
})

test('会话已经在 dsh 里开着（比如网页先接上了）：直接用它，不新建也不恢复', async () => {
  const live = []
  const sessionId = 'napcat-napcat-FriendMessage-' + ADMIN
  const agent = { session: { id: sessionId }, followup: m => live.push(m.content.map(c => c.text ?? '').join('')), cancel: () => {} }
  const h = harness({}, memberInfo, { live: { [sessionId]: agent } })
  await h.privateMsg(Number(ADMIN), [text('在吗')])
  assert.equal(h.created.length, 0)
  assert.equal(live.length, 1)
  assert.match(live[0], /在吗/)
  h.turn(sessionId, '在的')
  await new Promise(r => setTimeout(r, 30))
  assert.equal(h.sent.at(-1).text, '在的', '她的回复照常发回 QQ')
})

test('napcat/sent：她一轮说完、回复发出去以后通知其他插件', async () => {
  const h = harness({}, memberInfo)
  await h.privateMsg(8, [text('你好')])
  h.turn(String(h.created[0].sessionId), '你好呀')
  await new Promise(r => setTimeout(r, 20))
  assert.equal(h.sent.at(-1).text, '你好呀')
  assert.equal(h.events.sent.length, 1)
  assert.equal(h.events.sent[0].text, '你好呀')
  assert.equal(h.events.sent[0].umo, 'napcat:FriendMessage:8')
  assert.equal(h.events.sent[0].source, 'reply')
})

/** 假 ffmpeg：-version 报版本；只给 -i 时在 stderr 写时长并以 1 退出（和真的一样）；截图时输出一个 JPEG 头。 */
function fakeFfmpeg(seconds) {
  const dir = mkdtempSync(join(tmpdir(), 'ffmpeg-'))
  const bin = join(dir, 'ffmpeg')
  writeFileSync(bin, [
    '#!/bin/sh',
    'case "$*" in',
    '  *-version*) echo "ffmpeg version fake"; exit 0;;',
    '  *-frames:v*) printf "\\377\\330\\377\\340fakejpeg"; exit 0;;',
    '  *) echo "  Duration: 00:00:' + String(seconds).padStart(2, '0') + '.00, start: 0" 1>&2; exit 1;;',
    'esac',
  ].join('\n') + '\n')
  chmodSync(bin, 0o755)
  const video = join(dir, 'v.mp4')
  writeFileSync(video, 'not really a video')
  return { bin, video }
}

test('视频：没有 ffmpeg 时只写 [视频]；有 ffmpeg 时附截图和一句说明', async () => {
  const { bin, video } = fakeFfmpeg(10)
  const attachments = { admitPromptContent: async parts => parts }
  const h = harness({ imageToModel: true }, memberInfo, { attachments })
  await h.privateMsg(8, [{ type: 'video', data: { file: video } }])
  assert.equal(h.followups[0].text, '[视频]')
  assert.equal(h.followups[0].images, 0)
  h.set({ imageToModel: true, video: { enabled: true, maxFrames: 4, secondsPerFrame: 5, maxEdge: 1024, maxMB: 100, maxMinutes: 10, timeoutSeconds: 30, ffmpegPath: bin } })
  await h.privateMsg(8, [text('看这个'), { type: 'video', data: { file: video } }])
  assert.equal(h.followups[1].text, '看这个 [视频]\n[视频，时长 0:10，以下是从中截取的 2 张画面]')
  assert.equal(h.followups[1].images, 2)
})

test('视频：关掉「图片交给模型」时不截图', async () => {
  const { bin, video } = fakeFfmpeg(10)
  const h = harness({ imageToModel: false, video: { enabled: true, maxFrames: 4, secondsPerFrame: 5, maxEdge: 1024, maxMB: 100, maxMinutes: 10, timeoutSeconds: 30, ffmpegPath: bin } }, memberInfo, { attachments: { admitPromptContent: async p => p } })
  await h.privateMsg(8, [{ type: 'video', data: { file: video } }])
  assert.equal(h.followups[0].text, '[视频]')
  assert.equal(h.followups[0].images, 0)
})

test('wake：主动唤醒一个还没建过的 QQ 会话，回复照常发出去；以「不发」开头时不发', async () => {
  const h = harness({}, memberInfo)
  const r = await h.bridge.wake('napcat:FriendMessage:' + ADMIN, '现在是晚上八点，要不要找主人聊天？')
  assert.equal(r.sessionId, 'napcat-napcat-FriendMessage-' + ADMIN)
  assert.equal(h.followups[0].text, '现在是晚上八点，要不要找主人聊天？')
  assert.equal(h.bridge.sessionInfo(r.sessionId).adminPrivate, true, '按管理员 QQ 号认出主人私聊')
  h.turn(r.sessionId, '主人，晚饭吃了吗？')
  await new Promise(r => setTimeout(r, 20))
  assert.equal(h.sent.at(-1).action, 'send_private_msg')
  assert.equal(h.sent.at(-1).text, '主人，晚饭吃了吗？')
  const before = h.sent.length
  h.turn(r.sessionId, '[不发]')
  h.turn(r.sessionId, '  [不发] 这次先不打扰了')
  await new Promise(r => setTimeout(r, 20))
  assert.equal(h.sent.length, before, '以「不发」开头的回复不发出去')
  await h.bridge.wake('napcat:GroupMessage:555', [{ type: 'text', text: '看看群里' }])
  h.turn('napcat-napcat-GroupMessage-555', '大家好')
  await new Promise(r => setTimeout(r, 20))
  assert.equal(h.sent.at(-1).action, 'send_group_msg')
  await assert.rejects(h.bridge.wake('napcat:GroupMessage:9_555', 'x'), /不支持/)
  await assert.rejects(h.bridge.wake('bad', 'x'), /会话标识不对/)
})

const TTS_ON = { enabled: true, mode: 'tag', chance: 30, adminPrivate: true, private: false, group: false, maxChars: 20, alsoText: false, stripParens: true, speed: 100, timezone: 'Asia/Shanghai', breeze: { key: 'k', voiceId: 'v', model: '', language: '' }, inworld: { key: '', voiceId: '', model: '' } }
/** 假的语音合成：把要念的字当成音频内容，方便检查；「失败」两个字会报错 */
const fakeTts = { speak: async t => { if (t.includes('失败')) throw new Error('合成失败'); await new Promise(r => setTimeout(r, 15)); return { audio: Buffer.from(t), provider: 'breeze', ms: 1 } } }

test('文字转语音：她在一行开头写 [语音]，那一行发语音，其他照常发文字，顺序不变', async () => {
  const h = harness({ tts: TTS_ON }, memberInfo, { tts: fakeTts })
  await h.privateMsg(Number(ADMIN), [text('在吗')])
  assert.match(h.followups[0].text, /\[语音\]/, '主人私聊里提示她怎么发语音')
  h.turn(String(h.created[0].sessionId), '在的\n[语音] 想你了（抱住）\n你呢')
  await new Promise(r => setTimeout(r, 80))
  assert.deepEqual(h.sent.map(m => m.text), ['在的', '[语音:想你了（抱住）]', '你呢'])
  assert.deepEqual(h.events.sent.map(e => e.text), ['在的', '想你了（抱住）', '你呢'], '通知其他插件的是文字')
})

test('文字转语音：合成失败、太长就发文字；不能发语音的会话把 [语音] 去掉、也不提示', async () => {
  const h = harness({ tts: TTS_ON }, memberInfo, { tts: fakeTts })
  await h.privateMsg(Number(ADMIN), [text('在吗')])
  h.turn(String(h.created[0].sessionId), '[语音]这条会失败\n[语音]这一条特别特别特别特别特别特别特别特别特别长')
  await new Promise(r => setTimeout(r, 80))
  assert.deepEqual(h.sent.map(m => m.text), ['这条会失败', '这一条特别特别特别特别特别特别特别特别特别长'])
  await h.privateMsg(8, [text('你好')])
  assert.doesNotMatch(h.followups[1].text, /\[语音\]/)
  h.turn(String(h.created[1].sessionId), '[语音]你好呀')
  await new Promise(r => setTimeout(r, 40))
  assert.equal(h.sent.at(-1).text, '你好呀')
})


test('普通私聊移出白名单：消息、指令、主动唤醒、代发和排队回复都禁止；重新加回恢复', async () => {
  let release, started
  const waiting = new Promise(r => { started = r })
  const wl = { enabled: true, ids: ['77'], ignoreAdminOnGroup: true, ignoreAdminOnFriend: true }
  const h = harness({ whitelist: wl, pace: { ...settings().pace, typingPrivate: true, charsPerMinute: 60, typingMinSeconds: 1, typingMaxSeconds: 1 } }, memberInfo, {
    sleep: () => new Promise(r => { release = r; started() }),
  })
  await h.privateMsg(77, [text('在名单里')])
  h.turn(String(h.created[0].sessionId), '等待打字的回复')
  await waiting
  h.set({ whitelist: { ...wl, ids: ['555'] } })
  await h.privateMsg(77, [text('不在名单里')])
  await h.privateMsg(77, [text('/help')])
  await assert.rejects(h.bridge.wake('napcat:FriendMessage:77', '主动找主人'), /白名单/)
  await assert.rejects(h.bridge.sendBySession({ platform_name: 'napcat', message_type: 'FriendMessage', session_id: '77' }, { chain: [{ type: 'Plain', text: '代发' }] }), /白名单/)
  release()
  await new Promise(r => setTimeout(r, 20))
  assert.equal(h.followups.length, 1)
  assert.equal(h.sent.length, 0)
  assert.equal(h.events.sent.length, 0)
  h.set({ whitelist: wl })
  await h.privateMsg(77, [text('加回后恢复')])
  assert.equal(h.followups.length, 2)
})


test('两份名单独立：群号不放行私聊，私聊 QQ 不放行群；管理员在两边都豁免', async () => {
  const h = harness({ whitelist: { enabled: true, groupIds: ['555'], privateIds: ['77'] } }, memberInfo)
  await h.groupMsg(9, 555, [at(BOT), text('群在名单')])
  await h.privateMsg(77, [text('私聊在名单')])
  await h.privateMsg(555, [text('群名单的号码不能作为私聊许可')])
  await h.groupMsg(9, 77, [at(BOT), text('私聊名单的号码不能作为群许可')])
  assert.equal(h.followups.length, 2)
  await h.privateMsg(Number(ADMIN), [text('管理员无需列入')])
  await h.groupMsg(Number(ADMIN), 666, [at(BOT), text('管理员群内也豁免')])
  assert.equal(h.followups.length, 4)
})

test('管理员豁免不依赖旧开关；空名单也可私聊、群聊和主动私聊，群主动聊天不能借权限', async () => {
  const h = harness({ whitelist: { enabled: true, groupIds: [], privateIds: [], ignoreAdminOnGroup: false, ignoreAdminOnFriend: false } }, memberInfo)
  await h.privateMsg(Number(ADMIN), [text('管理员私聊')])
  await h.groupMsg(Number(ADMIN), 666, [at(BOT), text('管理员群聊')])
  h.turn(String(h.created[1].sessionId), '回复管理员')
  await new Promise(r => setTimeout(r, 20))
  assert.deepEqual(h.sent.map(x => x.text), ['回复管理员'])
  await h.bridge.wake('napcat:FriendMessage:' + ADMIN, '找管理员')
  await assert.rejects(h.bridge.wake('napcat:GroupMessage:666', '不能继承上轮管理员权限'), /白名单/)
  await assert.rejects(h.bridge.sendBySession({ platform_name: 'napcat', message_type: 'GroupMessage', session_id: '666' }, { chain: [{ type: 'Plain', text: '代发' }] }), /白名单/)
  await h.groupMsg(9, 666, [at(BOT), text('其他人不继承管理员权限')])
  assert.equal(h.followups.length, 3)
})

test('管理员不受入口限频；普通用户仍受同一群的限频', async () => {
  const h = harness({ rateLimit: { count: 1, seconds: 60, strategy: 'discard' } }, memberInfo)
  await h.groupMsg(Number(ADMIN), 555, [at(BOT), text('管理员一')])
  await h.groupMsg(Number(ADMIN), 555, [at(BOT), text('管理员二')])
  await h.groupMsg(9, 555, [at(BOT), text('普通一')])
  await h.groupMsg(9, 555, [at(BOT), text('普通二限频')])
  assert.equal(h.followups.length, 3)
})

test('队列权限按每轮真实来信快照：管理员不能给前一条普通回复留下豁免', async () => {
  let firstRelease, secondRelease, firstStarted, secondStarted
  const first = new Promise(r => { firstStarted = r }), second = new Promise(r => { secondStarted = r })
  let sleeps = 0
  const wl = { enabled: true, groupIds: ['555'], privateIds: [] }
  const h = harness({ whitelist: wl, pace: { ...settings().pace, typingGroup: true, charsPerMinute: 60, typingMinSeconds: 1, typingMaxSeconds: 1 } }, memberInfo, {
    sleep: () => new Promise(r => { if (++sleeps === 1) { firstRelease = r; firstStarted() } else { secondRelease = r; secondStarted() } }),
  })
  await h.groupMsg(9, 555, [at(BOT), text('普通成员')])
  const id = String(h.created[0].sessionId)
  h.turn(id, '普通成员的待发回复')
  await first
  await h.groupMsg(Number(ADMIN), 555, [at(BOT), text('管理员')])
  h.turn(id, '管理员的回复')
  h.set({ whitelist: { ...wl, groupIds: [] } })
  firstRelease()
  await second
  secondRelease()
  await new Promise(r => setTimeout(r, 20))
  assert.deepEqual(h.sent.map(x => x.text), ['管理员的回复'])
  assert.deepEqual(h.events.sent.map(x => x.text), ['管理员的回复'])
})

test('旧名单迁移：完整标识按类型分，裸号码保留旧匹配含义', () => {
  const old = ['555', 'napcat:GroupMessage:666', 'napcat:FriendMessage:77', '  ']
  assert.deepEqual(legacyWhitelistFor(old, 'GroupMessage'), ['555', 'napcat:GroupMessage:666'])
  assert.deepEqual(legacyWhitelistFor(old, 'FriendMessage'), ['555', 'napcat:FriendMessage:77'])
})
