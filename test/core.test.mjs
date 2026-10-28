// 单元测试：带历史版本的文本文件、改一段文字、会话分类和例外规则、放人格和核心记忆、按轮挑范围、消息存档。
// 用法：node --test test/（先 pnpm run build）
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { Archive } from '../lib/archive.js'
import { TextDoc, applyEdit } from '../lib/docs.js'
import { applyPrompt, CORE_SECTION, IDENTITY_SECTION, PERSONA_SECTION } from '../lib/prompt.js'
import { countRounds, pendingHumanTurn, selectRounds, truncationNote } from '../lib/rounds.js'
import { archiveRule, contextRule, matchRule, scopeOf } from '../lib/rules.js'

const tmp = () => mkdtempSync(join(tmpdir(), 'companion-'))

test('TextDoc：读写、改了才存历史、只留最近几份、回退', () => {
  const dir = tmp()
  let keep = 2
  const doc = new TextDoc(join(dir, 'p.md'), join(dir, 'h'), () => keep)
  assert.equal(doc.read(), '')
  assert.equal(doc.write('v1', { by: 'settings' }), undefined, '第一次写没有旧内容，不存历史')
  assert.equal(doc.read(), 'v1')
  assert.equal(doc.write('v1', { by: 'settings' }), undefined, '内容没变不存')
  doc.write('v2', { by: 'tool', sessionId: 's1', reason: '想改' })
  doc.write('v3', { by: 'settings' })
  doc.write('v4', { by: 'settings' })
  const h = doc.history()
  assert.equal(h.length, 2)
  assert.equal(doc.version(h[0].id), 'v3')
  assert.equal(doc.version(h[1].id), 'v2')
  assert.equal(readdirSync(join(dir, 'h')).length, 4, '每份历史一个 .md 一个 .json')
  assert.equal(doc.restore(h[1].id), true)
  assert.equal(doc.read(), 'v2')
  assert.equal(doc.history()[0].by, 'restore')
  assert.equal(doc.restore('../etc'), false, '不接受奇怪的 id')
  keep = 0
  doc.write('v5', { by: 'settings' })
  assert.equal(doc.history().length, 0, '份数设成 0 时不留历史')
})

test('applyEdit：替换、追加、找不到、不唯一', () => {
  assert.deepEqual(applyEdit('我爱吃苹果。', '苹果', '芒果'), { ok: true, text: '我爱吃芒果。' })
  assert.deepEqual(applyEdit('第一行', '', '第二行'), { ok: true, text: '第一行\n第二行' })
  assert.deepEqual(applyEdit('', '', '第一行'), { ok: true, text: '第一行' })
  assert.equal(applyEdit('abc', 'x', 'y').ok, false)
  assert.equal(applyEdit('aa', 'a', 'b').ok, false)
})

test('scopeOf：插件一登记的会话按类型分；没登记的 QQ 会话不当主人；dsh 自己的会话算主人', () => {
  const snowluma = { sessionInfo: id => ({
    m: { umo: 'u', sessionId: 'm', type: 'private', userId: '42', adminPrivate: true },
    p: { umo: 'u', sessionId: 'p', type: 'private', userId: '8', adminPrivate: false },
    g: { umo: 'u', sessionId: 'g', type: 'group', groupId: '555', adminPrivate: false },
  })[id] }
  assert.equal(scopeOf('m', snowluma).category, 'master')
  assert.equal(scopeOf('p', snowluma).category, 'private')
  assert.deepEqual(scopeOf('g', snowluma), { category: 'group', qq: true, umo: 'u', groupId: '555' })
  assert.equal(scopeOf('snowluma-snowluma-GroupMessage-555', snowluma).category, 'group')
  assert.equal(scopeOf('snowluma-snowluma-FriendMessage-42').category, 'private')
  assert.deepEqual(scopeOf('session-abc'), { category: 'master', qq: false })
})

test('例外规则：群按群号、私聊按 QQ 号；空着的项用默认', () => {
  const defaults = {
    context: { master: { maxRounds: 60, dropRounds: 20, mode: 'llm' }, private: { maxRounds: 60, dropRounds: 20, mode: 'truncate' }, group: { maxRounds: 60, dropRounds: 20, mode: 'truncate' } },
    archive: { master: { days: 365, unwoken: true }, private: { days: 5, unwoken: true }, group: { days: 5, unwoken: true } },
  }
  const rows = [
    { target: '555', kind: 'group', maxRounds: 10, mode: 'llm', archiveUnwoken: 'off' },
    { target: '8', kind: 'user', archiveDays: 30 },
    { target: '555', kind: 'user', maxRounds: 1 },
  ]
  const group = { category: 'group', qq: true, groupId: '555' }
  assert.deepEqual(contextRule(group, defaults, rows), { maxRounds: 10, dropRounds: 20, mode: 'llm' })
  assert.deepEqual(archiveRule(group, defaults, rows), { days: 5, unwoken: false })
  const p = { category: 'private', qq: true, userId: '8' }
  assert.deepEqual(contextRule(p, defaults, rows), defaults.context.private)
  assert.deepEqual(archiveRule(p, defaults, rows), { days: 30, unwoken: true })
  assert.equal(matchRule({ category: 'master', qq: false }, rows), undefined)
})

const assembly = () => ({
  sections: [
    { name: IDENTITY_SECTION, text: 'You are an AI agent powered by DeepSeek Harness.' },
    { name: PERSONA_SECTION, text: 'You are a coding agent powered by the {{model}} model.' },
    { name: 'other', text: '别的段' },
  ],
  contexts: [], tools: [], variables: {},
})

test('applyPrompt：换人格、去掉身份句、核心记忆放在人格后面、不做变量替换', () => {
  const out = applyPrompt(assembly(), { persona: '你是大肥鱼 {{x}}', core: '主人爱吃红烧肉', personaOnly: true })
  assert.deepEqual(out.sections.map(s => s.name), [PERSONA_SECTION, CORE_SECTION, 'other'])
  assert.equal(out.sections[0].text, '你是大肥鱼 {{x}}')
  assert.equal(out.sections[0].interpolate, false)
  assert.match(out.sections[1].text, /<core_memory>[\s\S]*主人爱吃红烧肉[\s\S]*<\/core_memory>/)
  const keepIdentity = applyPrompt(assembly(), { persona: '你是大肥鱼', core: '', personaOnly: false })
  assert.deepEqual(keepIdentity.sections.map(s => s.name), [IDENTITY_SECTION, PERSONA_SECTION, 'other'])
  const untouched = assembly()
  assert.equal(applyPrompt(untouched, { persona: '  ', core: '', personaOnly: true }), untouched, '人格和核心记忆都空时不动 dsh 原来的')
  const noPersonaSection = applyPrompt({ ...assembly(), sections: [{ name: 'other', text: 'x' }] }, { persona: 'P', core: 'C', personaOnly: true })
  assert.deepEqual(noPersonaSection.sections.map(s => s.name), [PERSONA_SECTION, CORE_SECTION, 'other'])
})

/** 假会话：kinds 里 s=系统 u=人说的话 a=她的回复 c=运行信息（不算一轮） t=turn/start（只在日志里） */
function fakeSession(kinds) {
  const events = kinds.map((k, i) => ({
    seq: i,
    type: { s: 'system/message', u: 'user/message', a: 'assistant/message', c: 'user/message', t: 'turn/start' }[k],
    data: k === 'u' ? { source: { kind: 'plugin:snowluma-bridge' } } : k === 'c' ? { source: { kind: 'runtime-context' } } : {},
  }))
  return { seq: events.length, surface: { nodes: events.filter(e => e.type !== 'turn/start').map(e => e.seq) }, eventAt: seq => events[seq] }
}

test('按轮数：数轮、刚开始一轮时把正在进来的算上、挑最早的几轮、至少留一轮、不拆工具调用', () => {
  const s = fakeSession(['s', 'u', 'c', 'a', 'u', 'a', 'u', 'a', 't'])
  assert.equal(countRounds(s), 3)
  assert.equal(pendingHumanTurn(s), true)
  assert.equal(pendingHumanTurn(fakeSession(['s', 'u', 't', 'u', 'a'])), false)
  assert.deepEqual(selectRounds(s, 2, () => true), { start: 1, end: 5, rounds: 2 })
  assert.deepEqual(selectRounds(s, 10, () => true), { start: 1, end: 5, rounds: 2 }, '最多截到只剩最新一轮')
  assert.equal(selectRounds(fakeSession(['s', 'u', 'a']), 5, () => true), null)
  // 第 3 轮前的切口不完整（工具调用没收尾），往前挪
  assert.deepEqual(selectRounds(s, 2, seq => seq !== 6), { start: 1, end: 4, rounds: 2 })
  assert.match(truncationNote(20), /20 轮/)
})

test('消息存档：存、同一条不重复、最近几条、统计', () => {
  const a = new Archive(':memory:')
  const base = { umo: 'snowluma:GroupMessage:555', kind: 'group', groupId: '555', direction: 'in', senderId: '9', senderName: '群友', woke: false, type: 'message' }
  assert.equal(a.add({ ...base, messageId: '1', time: 1000, text: '第一条' }), true)
  assert.equal(a.add({ ...base, messageId: '1', time: 1000, text: '第一条' }), false)
  a.add({ ...base, messageId: '2', time: 2000, text: '第二条', woke: true })
  a.add({ ...base, direction: 'out', senderId: 'self', senderName: '她', time: 3000, text: '回复', woke: true })
  a.add({ ...base, direction: 'out', senderId: 'self', senderName: '她', time: 3001, text: '回复', woke: true })
  const recent = a.recent('snowluma:GroupMessage:555', 2)
  assert.deepEqual(recent.map(m => m.text), ['回复', '回复'])
  assert.equal(a.recent('snowluma:GroupMessage:555', 10)[0].woke, false)
  assert.deepEqual(a.stats(), { total: 4, byKind: { group: 4 }, oldest: 1000, newest: 3001 })
  a.close()
})

test('核心记忆按字数限制：主人的和公开的分开算，到了上限只许改短', async () => {
  const { coreTool } = await import('../lib/tools.js')
  const dir = tmp()
  const doc = name => new TextDoc(join(dir, name + '.md'), join(dir, 'history-' + name), () => 5)
  const coreMaster = doc('master'), corePublic = doc('public')
  corePublic.write('一二三四五', { by: 'settings' })
  const tool = coreTool({ persona: doc('persona'), coreMaster, corePublic, isMaster: () => true, log: () => {}, coreMaxChars: which => which === 'public' ? 8 : 20 })
  const run = args => tool.execute({ reason: '测试', ...args }, { session: { id: 'master' }, sessionId: 'master' })
  assert.equal((await run({ memory: 'public', old_text: '', new_text: '六七八' })).ok, true, '8 个字以内（空格不算）')
  assert.equal((await run({ memory: 'public', old_text: '', new_text: '九' })).ok, false, '公开的超过 8 字')
  assert.equal((await run({ memory: 'private', old_text: '', new_text: '主人的可以写到二十个字这里十五个' })).ok, true, '主人的上限另算')
  assert.equal((await run({ memory: 'public', old_text: '六七八', new_text: '六' })).ok, true, '改短总是可以')
})


test('存档权限接口缺失、拒绝、异常均禁止；允许时使用实时会话权限', async () => {
  const { archiveAllowed } = await import('../lib/rules.js')
  const session = { platform_name: 'snowluma', message_type: 'GroupMessage', session_id: '555' }
  assert.equal(archiveAllowed(undefined, session), false)
  assert.equal(archiveAllowed({}, session), false)
  assert.equal(archiveAllowed({ canArchive: () => true }, undefined), false)
  assert.equal(archiveAllowed({ canArchive: () => { throw new Error('not ready') } }, session), false)
  let allowed = false
  const service = { canArchive: s => { assert.equal(s, session); return allowed } }
  assert.equal(archiveAllowed(service, session), false)
  allowed = true
  assert.equal(archiveAllowed(service, session), true)
})
