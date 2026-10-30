// 单元测试：日记文件、按凌晨分界算日期、认日期、新会话给她看的那段（预算）、
// 每日任务：写日记和月度总览、存档到期（整理 → 换会话 → 删存档 → 归档/删旧会话）、清理图片。
// 用法：node --test test/（先 pnpm run build）
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { Archive } from '../../lib/companion/archive.js'
import { DiaryStore, diaryBlock, guessDate, localClock, logicalDay } from '../../lib/companion/diary.js'
import { Maintenance } from '../../lib/companion/maintenance.js'
import { MemoryStore } from '../../lib/companion/memory.js'
import { Organizer } from '../../lib/companion/organizer.js'

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
  const m = new Maintenance({
    archive, store, diary, organizer, llm: () => llm, target: () => ({ provider: 'p', model: 'm' }),
    settings: () => ({ diaryEnabled: true, monthlyEnabled: true, boundaryHour: 4, timeZone: 'Asia/Shanghai', ...over }),
    log: () => {},
  })
  return { archive, store, diary, llm, organizer, m, home }
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
