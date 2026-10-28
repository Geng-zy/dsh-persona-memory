// 单元测试：日记文件、按凌晨分界算日期、认日期、新会话给她看的那段（预算）、
// 每日任务：写日记和月度总览、存档到期（整理 → 换会话 → 删存档 → 归档/删旧会话）、清理图片。
// 用法：node --test test/（先 pnpm run build）
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { Archive } from '../../lib/companion/archive.js'
import { DiaryStore, diaryBlock, guessDate, localClock, logicalDay } from '../../lib/companion/diary.js'
import { Maintenance } from '../../lib/companion/maintenance.js'
import { MemoryStore } from '../../lib/companion/memory.js'
import { Organizer } from '../../lib/companion/organizer.js'

const DAY = 86_400_000
const tmp = () => mkdtempSync(join(tmpdir(), 'companion-diary-'))

test('日期：凌晨分界、本地时钟、从文件名或正文认日期', () => {
  const t = Date.parse('2026-10-24T17:30:00Z') // 上海 10-25 01:30
  assert.equal(logicalDay(t, 4, 'Asia/Shanghai'), '2026-10-24')
  assert.equal(logicalDay(t + 3 * 3_600_000, 4, 'Asia/Shanghai'), '2026-10-25')
  assert.equal(localClock(t, 'Asia/Shanghai'), '01:30')
  assert.equal(guessDate('2026-10-19.md', ''), '2026-10-19')
  assert.equal(guessDate('diary_20261020.txt', ''), '2026-10-20')
  assert.equal(guessDate('a.md', '# 2026年10月3日 晴'), '2026-10-03')
  assert.equal(guessDate('a.md', '没有日期'), undefined)
})

test('日记文件：读写、按日期排、最近几天、月度总览、删除', () => {
  const d = new DiaryStore(join(tmp(), 'diary'))
  d.writeDay('2026-10-19', '# 2026-10-19\n第一篇')
  d.writeDay('2026-10-21', '# 2026-10-21\n第三篇')
  d.writeDay('2026-10-20', '# 2026-10-20\n第二篇')
  d.writeMonth('2026-09', '# 九月总览')
  assert.deepEqual(d.days(), ['2026-10-21', '2026-10-20', '2026-10-19'])
  assert.deepEqual(d.recentDays(2).map(e => e.date), ['2026-10-20', '2026-10-21'])
  assert.deepEqual(d.recentDays(5, '2026-10-21').map(e => e.date), ['2026-10-19', '2026-10-20'])
  assert.deepEqual(d.recentMonths(12).map(e => e.text.trim()), ['# 九月总览'])
  assert.throws(() => d.writeDay('../x', 'x'))
  assert.equal(d.deleteDay('2026-10-19'), true)
  assert.equal(d.readDay('2026-10-19'), undefined)
})

test('新会话给她看的那段：月度总览 + 日记 + 上个会话；超预算先缩早的、再去掉早的', () => {
  const months = [{ date: '2026-09', text: '# 九月总览\n很多事' }]
  const days = [{ date: '2026-10-19', text: '# 10-19\n' + '长'.repeat(500) }, { date: '2026-10-20', text: '# 10-20\n最近一天' }]
  const full = diaryBlock(months, days, '主人：晚安', 100000)
  assert.match(full, /^<diary>[\s\S]*你自己写的日记[\s\S]*九月总览[\s\S]*10-19[\s\S]*10-20[\s\S]*主人：晚安[\s\S]*<\/diary>$/)
  const squeezed = diaryBlock(months, days, '', 400)
  assert.ok(squeezed.length <= 400)
  assert.match(squeezed, /最近一天/)
  assert.ok(!squeezed.includes('长'.repeat(200)))
  assert.equal(diaryBlock([], [], '', 1000), '')
})

function fakeLlm(reply) {
  const prompts = []
  return {
    prompts,
    stream: async function* (options) {
      const text = options.messages[0].content[0].text
      prompts.push(text)
      yield { type: 'text-delta', text: typeof reply === 'function' ? reply(text) : reply }
      yield { type: 'finish', finish: { kind: 'stop' } }
    },
  }
}

function setup(over = {}) {
  const home = tmp()
  const archive = new Archive(':memory:')
  const store = new MemoryStore(archive.db, () => 'Asia/Shanghai')
  const diary = new DiaryStore(join(home, 'diary'))
  const llm = fakeLlm(p => p.includes('月度总览') ? '# 2026-09 月度总览\n九月' : p.includes('日记') ? '# 日记\n今天主人说想吃芒果。' : '[]')
  const organizer = new Organizer({ archive, store, llm: () => llm, target: () => ({ provider: 'p', model: 'm' }), log: () => {}, afterWrite: () => {} })
  const rotated = []
  const registryCalls = []
  const carry = new Map()
  const sessionsRoot = join(home, 'sessions')
  const known = new Set()
  const m = new Maintenance({
    archive, store, diary, organizer, llm: () => llm, target: () => ({ provider: 'p', model: 'm' }),
    settings: () => ({ diaryEnabled: true, monthlyEnabled: true, boundaryHour: 4, timeZone: 'Asia/Shanghai', rotateSessions: true, deleteOldSessions: true, carryMessages: 3,
      archiveDays: s => (s.category === 'master' ? 365 : 5), ...over }),
    snowluma: () => ({ rotateSession: async umo => { rotated.push(umo); return { oldSessionId: 'snowluma-' + umo.replace(/[^A-Za-z0-9-]/g, '-'), newSessionId: 'snowluma-new-' + rotated.length } } }),
    registry: () => ({
      archiveSession: async id => { registryCalls.push(['archive', id]) },
      unarchiveSession: async id => { registryCalls.push(['unarchive', id]) },
      list: () => [{ sessionIds: [...known], detachSession: async id => { registryCalls.push(['detach', id]); known.delete(id) } }],
    }),
    persistence: () => ({ stat: async id => (existsSync(join(sessionsRoot, 'proj', id)) ? {} : undefined), list: async () => [] }),
    isLive: () => false,
    sessionsRoot, mediaDir: join(home, 'media'),
    setCarry: (umo, text) => carry.set(umo, text),
    log: () => {},
  })
  return { archive, store, diary, llm, organizer, m, rotated, registryCalls, carry, sessionsRoot, known, home }
}

test('写日记：只用主人的聊天和 dsh 会话流水；跨月写总览；没聊天不写', async () => {
  const t = setup()
  const now = Date.parse('2026-10-24T17:30:00Z')
  const master = 'snowluma:FriendMessage:42'
  t.organizer.rememberCategory(master, 'master')
  const base = { kind: 'private', type: 'message', woke: true, direction: 'in', senderName: '主人', senderId: '42' }
  t.archive.add({ ...base, umo: master, userId: '42', messageId: '1', time: now - 3_600_000, text: '我想吃芒果' })
  t.archive.add({ ...base, umo: 'snowluma:FriendMessage:8', userId: '8', senderId: '8', senderName: '别人', messageId: '2', time: now - 3_600_000, text: '别人的话' })
  t.archive.add({ ...base, umo: 'snowluma:GroupMessage:5', kind: 'group', groupId: '5', messageId: '3', time: now - 3_600_000, text: '群里的话' })
  t.archive.addJournal('session-abc', 'master', '在 dsh 里说的话', now - 1000)
  t.diary.writeDay('2026-09-30', '# 2026-09-30\n九月最后一天')
  const r = await t.m.writeDiary(now)
  assert.deepEqual(r, { date: '2026-10-24', written: true, month: '2026-09' })
  assert.match(t.diary.readDay('2026-10-24'), /芒果/)
  assert.match(t.diary.readMonth('2026-09'), /九月/)
  const prompt = t.llm.prompts.find(p => p.includes('写一篇 2026-10-24 的日记'))
  assert.match(prompt, /我想吃芒果[\s\S]*在 dsh 里说的话/)
  assert.ok(!prompt.includes('别人的话') && !prompt.includes('群里的话'), '日记不写别人和群里的事')
  assert.equal(t.store.list({ status: 'all' }).items.filter(m => m.kind === 'diary').length, 2)
  const again = await t.m.writeDiary(now + 60_000)
  assert.equal(again.written, false, '这段时间没有新聊天，不再写')
})

test('存档到期：先整理，换会话（带最近几条），删存档，旧会话归档；别人的旧会话过期后删掉，主人的不删', async () => {
  const t = setup()
  const now = Date.now()
  const group = 'snowluma:GroupMessage:555'
  const master = 'snowluma:FriendMessage:42'
  t.organizer.rememberCategory(master, 'master')
  const g = { umo: group, kind: 'group', groupId: '555', type: 'message', woke: true, direction: 'in', senderName: '群友', senderId: '9' }
  const oldId = 'snowluma-snowluma-GroupMessage-555'
  t.archive.add({ ...g, messageId: '1', time: now - 7 * DAY, text: '一周前', sessionId: oldId })
  t.archive.add({ ...g, messageId: '2', time: now - 6 * DAY, text: '六天前', sessionId: oldId })
  t.archive.add({ ...g, messageId: '3', time: now - DAY, text: '昨天', sessionId: oldId })
  t.archive.add({ umo: master, kind: 'private', userId: '42', type: 'message', woke: true, direction: 'in', senderName: '主人', senderId: '42', messageId: '9', time: now - 10 * DAY, text: '十天前', sessionId: 'snowluma-snowluma-FriendMessage-42' })
  const report = await t.m.run(now, 'expire')
  assert.deepEqual(t.rotated, [group], '只有群会话用满了保留期')
  assert.equal(report.expired.find(e => e.umo === group).deleted, 2)
  assert.deepEqual(t.archive.recent(group, 10).map(r => r.text), ['昨天'])
  assert.match(t.carry.get(group), /一周前[\s\S]*昨天/)
  assert.deepEqual(t.registryCalls, [['archive', oldId]])
  assert.equal(t.archive.retiredList()[0].state, 'archived')
  assert.equal(t.archive.recent(master, 10).length, 1, '主人的存档 365 天才到期')
  // 旧会话最后一条也过期了：删掉
  mkdirSync(join(t.sessionsRoot, 'proj', oldId), { recursive: true })
  writeFileSync(join(t.sessionsRoot, 'proj', oldId, 'log.jsonl'), '{}')
  t.known.add(oldId)
  const later = await t.m.run(now + 6 * DAY, 'expire')
  assert.deepEqual(later.deletedSessions, [oldId])
  assert.equal(existsSync(join(t.sessionsRoot, 'proj', oldId)), false)
  assert.deepEqual(t.registryCalls.slice(1).map(c => c[0]), ['detach', 'unarchive'])
  assert.equal(t.archive.retiredList()[0].state, 'deleted')
})

test('删旧会话：只删插件一建的会话；找不到文件夹算失败', async () => {
  const t = setup()
  await assert.rejects(t.m.deleteSession('session-abc'), /只删/)
  await assert.rejects(t.m.deleteSession('snowluma-x'), /没找到会话文件夹/)
})

test('清理没被引用的图片', async () => {
  const t = setup()
  const media = join(t.home, 'media')
  mkdirSync(media, { recursive: true })
  const used = 'a'.repeat(64) + '.png'
  const unused = 'b'.repeat(64) + '.jpg'
  writeFileSync(join(media, used), 'x')
  writeFileSync(join(media, unused), 'y')
  t.archive.add({ umo: 'u', kind: 'group', groupId: '1', type: 'message', woke: false, direction: 'in', senderName: 'a', senderId: '1', messageId: '1', time: Date.now(), text: '', segments: JSON.stringify([{ type: 'Image', _local: used }]) })
  const r = await t.m.run(Date.now(), 'expire')
  assert.equal(r.mediaRemoved, 1)
  assert.equal(existsSync(join(media, used)), true)
  assert.equal(existsSync(join(media, unused)), false)
})
