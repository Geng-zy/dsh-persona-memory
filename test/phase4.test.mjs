// 单元测试：主动聊天（免打扰、随机间隔、她刚说过话不触发、只找最近聊过的、群聊带上下文）、
// 自动清理、定期整合和撤销、备份打包/列表/核对/导入替换。
// 用法：node --test test/（先 pnpm run build）
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { Archive } from '../lib/archive.js'
import { applyPendingImport, createBackup, inspectBackup, listBackups, prune, readSavedSettings } from '../lib/backup.js'
import { Care, similarGroups } from '../lib/care.js'
import { MemoryStore } from '../lib/memory.js'
import { Organizer } from '../lib/organizer.js'
import { Proactive, inQuiet, nextDelay, proactivePrompt } from '../lib/proactive.js'

const MIN = 60_000
const DAY = 86_400_000
const tmp = () => mkdtempSync(join(tmpdir(), 'companion-p4-'))

test('免打扰（可以跨午夜）和随机间隔（主人、别人各自的范围）', () => {
  assert.equal(inQuiet('01:30', '01:00', '09:00'), true)
  assert.equal(inQuiet('09:00', '01:00', '09:00'), false)
  assert.equal(inQuiet('23:30', '23:00', '07:00'), true)
  assert.equal(inQuiet('06:59', '23:00', '07:00'), true)
  assert.equal(inQuiet('12:00', '23:00', '07:00'), false)
  const s = { masterMinMinutes: 60, masterMaxMinutes: 240, othersMinMinutes: 120, othersMaxMinutes: 240 }
  assert.equal(nextDelay('master', s, () => 0), 60 * MIN)
  assert.equal(nextDelay('master', s, () => 1), 240 * MIN)
  assert.equal(nextDelay('group', s, () => 0.5), 180 * MIN)
  assert.equal(nextDelay('private', s, () => 0), 120 * MIN)
  assert.match(proactivePrompt('master', Date.now(), Date.now() - 3 * 3_600_000, { silenceToken: '[不发]', timeZone: 'Asia/Shanghai' }), /3 小时前[\s\S]*主动找主人[\s\S]*只回复「\[不发\]」/)
})

function setupProactive(over = {}) {
  const home = tmp()
  const archive = new Archive(':memory:')
  const store = new MemoryStore(archive.db)
  const organizer = new Organizer({ archive, store, llm: () => undefined, target: () => undefined, log: () => {}, afterWrite: () => {} })
  const metaMap = new Map()
  const woken = []
  const p = new Proactive({
    archive, organizer, mediaDir: join(home, 'media'), log: () => {},
    meta: { get: k => metaMap.get(k), set: (k, v) => metaMap.set(k, v) },
    wake: () => async (umo, content) => { woken.push({ umo, text: content.map(c => c.text ?? '[图]').join('\n'), images: content.filter(c => c.type === 'image').length }) },
    random: () => 0,
    settings: () => ({ enabled: true, masterMinMinutes: 60, masterMaxMinutes: 240, othersMinMinutes: 120, othersMaxMinutes: 240, privateEnabled: true, groupEnabled: true,
      quietStart: '01:00', quietEnd: '09:00', recentMinutes: 30, groupContextMessages: 15, activeWithinDays: 7,
      silenceToken: '[不发]', timeZone: 'UTC', override: () => undefined, ...over }),
  })
  return { archive, organizer, metaMap, woken, p, home }
}

test('主动聊天：先排时间；到点、不在免打扰、她没刚说过话才唤醒；她刚说过话顺延（别人说话不算）；别人很久没聊不找', async () => {
  const t = setupProactive()
  const master = 'napcat:FriendMessage:42'
  const group = 'napcat:GroupMessage:555'
  const stale = 'napcat:FriendMessage:8'
  const day = Date.parse('2026-10-24T00:00:00Z')
  const noon = day + 12 * 3_600_000
  t.organizer.rememberCategory(master, 'master')
  const msg = (umo, kind, time, text, extra = {}) => t.archive.add({ umo, kind, type: 'message', woke: true, direction: 'in', senderName: 'x', senderId: '1', time, text, ...extra })
  msg(master, 'private', noon - 5 * 3_600_000, '早上好', { userId: '42' })
  msg(group, 'group', noon - 3_600_000, '群里有人在聊游戏', { groupId: '555' })
  msg(stale, 'private', noon - 30 * DAY, '一个月前', { userId: '8' })
  assert.deepEqual(await t.p.tick(noon), [], '第一次只排时间')
  assert.equal(Number(t.metaMap.get('proactive:next:' + master)), noon + 60 * MIN)
  assert.equal(Number(t.metaMap.get('proactive:next:' + group)), noon + 120 * MIN, '群用自己的范围')
  assert.equal(t.metaMap.get('proactive:next:' + stale), undefined, '很久没聊的别人不找')
  assert.deepEqual(await t.p.tick(noon + 61 * MIN), [master])
  assert.match(t.woken[0].text, /<proactive>[\s\S]*主人/)
  // 群：到点了，但她刚在群里说过话 → 从她那句起顺延
  t.archive.add({ umo: group, kind: 'group', groupId: '555', type: 'message', woke: true, direction: 'out', senderName: '她', senderId: 'self', time: noon + 119 * MIN, text: '她刚说的' })
  assert.ok(!(await t.p.tick(noon + 121 * MIN)).includes(group), '她刚说过话，不唤醒')
  assert.equal(Number(t.metaMap.get('proactive:next:' + group)), noon + 119 * MIN + 120 * MIN)
  // 别人刚说过话不影响
  msg(group, 'group', noon + 238 * MIN, '群友刚说的一句', { groupId: '555' })
  assert.ok((await t.p.tick(noon + 240 * MIN)).includes(group), '只是群友刚说过话，照样唤醒')
  // 免打扰：凌晨 2 点到点也不唤醒
  t.metaMap.set('proactive:next:' + master, String(day + 26 * 3_600_000 - MIN))
  assert.deepEqual(await t.p.tick(day + 26 * 3_600_000), [])
  assert.ok(Number(t.metaMap.get('proactive:next:' + master)) >= day + 26 * 3_600_000 + 30 * MIN)
  // 群：带上下文（含她自己说的）
  t.archive.add({ umo: group, kind: 'group', groupId: '555', type: 'message', woke: true, direction: 'out', senderName: '她', senderId: 'self', time: noon + 300 * MIN, text: '我也想玩' })
  t.metaMap.set('proactive:next:' + group, String(noon + 600 * MIN))
  assert.deepEqual(await t.p.tick(noon + 601 * MIN), [group])
  assert.match(t.woken.findLast(w => w.umo === group).text, /群里最近的消息[\s\S]*群里有人在聊游戏[\s\S]*\[我\] 我也想玩[\s\S]*只回复「\[不发\]」/)
})

test('主动聊天：例外规则能关掉某个会话；总开关关掉就都不动', async () => {
  const t = setupProactive({ override: s => (s.category === 'master' ? false : undefined) })
  const master = 'napcat:FriendMessage:42'
  t.organizer.rememberCategory(master, 'master')
  t.archive.add({ umo: master, kind: 'private', userId: '42', type: 'message', woke: true, direction: 'in', senderName: 'x', senderId: '42', time: Date.now(), text: 'hi' })
  await t.p.tick()
  assert.equal(t.metaMap.size, 0)
  assert.deepEqual(t.p.list(), [])
})

function fakeLlm(reply) {
  return { stream: async function* () { yield { type: 'text-delta', text: reply }; yield { type: 'finish', finish: { kind: 'stop' } } } }
}

test('自动清理：久没想起又不重要的按遗忘方式处理；日记不动', () => {
  const archive = new Archive(':memory:')
  const store = new MemoryStore(archive.db)
  const now = Date.now()
  const care = new Care({ db: archive.db, store, llm: () => undefined, target: () => undefined, log: () => {},
    settings: () => ({ cleanupEnabled: true, cleanupDays: 90, cleanupImportance: 0.2, purgeForgottenEnabled: false, purgeForgottenDays: 180, consolidateEnabled: true, consolidateOverlap: 0.5, consolidateGroups: 20, halfLifeDays: 30, forgetMode: sc => (sc === 'master' ? 'normal' : 'purge') }) })
  const a = store.add({ scope: 'master', content: '主人有一次说过天气不错', importance: 0.3, writer: 'organize' })
  const b = store.add({ scope: 'group:5', content: '群友说过一句闲话', importance: 0.3, writer: 'organize' })
  const c = store.add({ scope: 'master', kind: 'diary', content: '# 很久以前的日记', importance: 0.1, writer: 'diary' })
  const d = store.add({ scope: 'master', content: '主人最爱吃红烧肉', importance: 0.9, writer: 'organize' })
  archive.db.prepare('UPDATE memories SET created_at = ?').run(now - 200 * DAY)
  const r = care.cleanup(now)
  assert.deepEqual(r, { forgotten: 2, purged: 1 }, '红烧肉衰减后也低于门槛；主人的进普通遗忘、群的彻底删')
  assert.equal(store.get(a.id).status, 'forgotten')
  assert.equal(store.get(b.id), undefined)
  assert.equal(store.get(c.id).status, 'active', '日记不清理')
  assert.equal(store.get(d.id).status, 'forgotten')
})

test('定期整合：相近的合成一条，旧的被取代；撤销恢复；别人的旧记忆下一次才删', async () => {
  const archive = new Archive(':memory:')
  const store = new MemoryStore(archive.db)
  const mode = { v: 'normal' }
  const care = new Care({ db: archive.db, store, llm: () => fakeLlm('[{"content":"主人养了一只叫咪咪的橘猫","kind":"fact","importance":0.7}]'), target: () => ({ provider: 'p', model: 'm' }), log: () => {},
    settings: () => ({ cleanupEnabled: false, cleanupDays: 90, cleanupImportance: 0.2, purgeForgottenEnabled: false, purgeForgottenDays: 180, consolidateEnabled: true, consolidateOverlap: 0.3, consolidateGroups: 20, halfLifeDays: 30, forgetMode: sc => (sc === 'master' ? 'normal' : mode.v) }) })
  const x = store.add({ scope: 'master', content: '主人养了一只猫', writer: 'organize' })
  const y = store.add({ scope: 'master', content: '主人养了一只猫叫咪咪', writer: 'organize' })
  store.add({ scope: 'master', content: '主人下周三面试', writer: 'organize' })
  assert.equal(similarGroups(store.active(['master']), 0.3, 10).length, 1)
  const r = await care.consolidate()
  assert.deepEqual(r, { groups: 1, merged: 2, created: 1, purgedOld: 0 })
  assert.deepEqual(store.active(['master']).map(m => m.content).sort(), ['主人下周三面试', '主人养了一只叫咪咪的橘猫'])
  assert.equal(care.lastRun().groups[0].old.length, 2)
  assert.equal(care.undoLast(), 1)
  assert.deepEqual(store.active(['master']).map(m => m.id).sort(), [x.id, y.id, x.id + 2].sort())
  // 别人的：整合后不立刻删，下一次整合时才删
  mode.v = 'purge'
  const g1 = store.add({ scope: 'group:5', content: '群里在聊原神', writer: 'organize' })
  store.add({ scope: 'group:5', content: '群里在聊原神新角色', writer: 'organize' })
  await care.consolidate()
  assert.ok(store.get(g1.id), '还在（可以撤销）')
  await care.consolidate()
  assert.equal(store.get(g1.id), undefined, '下一次整合时删掉')
})

test('备份：打包（不含别人的存档、不含 Key）、列表、每类留几份、核对、导入替换', async () => {
  const dataDir = tmp()
  const archive = new Archive(join(dataDir, 'companion.db'))
  const store = new MemoryStore(archive.db)
  mkdirSync(join(dataDir, 'persona'), { recursive: true })
  writeFileSync(join(dataDir, 'persona', 'persona.md'), '你是大肥鱼')
  mkdirSync(join(dataDir, 'persona', 'history'), { recursive: true })
  writeFileSync(join(dataDir, 'persona', 'history', 'old.md'), '很早以前的人格')
  mkdirSync(join(dataDir, 'diary'), { recursive: true })
  writeFileSync(join(dataDir, 'diary', '2026-10-24.md'), '# 日记')
  mkdirSync(join(dataDir, 'media'), { recursive: true })
  const img = 'c'.repeat(64) + '.png'
  writeFileSync(join(dataDir, 'media', img), 'png')
  writeFileSync(join(dataDir, 'media', 'd'.repeat(64) + '.png'), 'other')
  archive.setCursor('cat:napcat:FriendMessage:42', 1)
  archive.add({ umo: 'napcat:FriendMessage:42', kind: 'private', userId: '42', type: 'message', woke: true, direction: 'in', senderName: '主人', senderId: '42', time: 1000, text: '主人的话', segments: JSON.stringify([{ type: 'Image', _local: img }]) })
  archive.add({ umo: 'napcat:GroupMessage:5', kind: 'group', groupId: '5', type: 'message', woke: true, direction: 'in', senderName: '群友', senderId: '9', time: 2000, text: '群里的话', segments: JSON.stringify([{ type: 'Image', _local: 'd'.repeat(64) + '.png' }]) })
  store.add({ scope: 'master', content: '主人爱吃红烧肉', writer: 'settings' })
  const out = join(dataDir, 'backups')
  const opts = { dataDir, db: archive.db, outDir: out, plugin: '0.4.0', schema: 4, settings: { recallTopK: 6 }, embed: { model: 'm', dim: 4 }, keep: 2 }
  const { name, manifest } = await createBackup({ ...opts, reason: 'manual', now: Date.parse('2026-10-24T10:00:00Z') })
  // 文件名用本地时间
  const d = new Date(Date.parse('2026-10-24T10:00:00Z')), p2 = n => String(n).padStart(2, '0')
  assert.equal(name, 'companion-manual-' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + p2(d.getHours()) + p2(d.getMinutes()) + '00.tar.gz')
  assert.deepEqual(manifest.counts, { memories: 1, diaryDays: 1, months: 0, archiveMessages: 1, media: 1, masterSessions: 0 })
  assert.ok(!manifest.items.includes('sessionsMaster'), '默认不带原始会话')
  assert.ok(!JSON.stringify(manifest).includes('embedApiKey'))
  assert.ok(!manifest.files.some(f => f.path.includes('history')), '不带历史版本')
  for (let i = 1; i <= 3; i++) await createBackup({ ...opts, reason: 'auto', now: Date.parse('2026-10-2' + i + 'T04:00:00Z') })
  assert.deepEqual(listBackups(out).map(b => b.reason).sort(), ['auto', 'auto', 'manual'], '自动的只留 2 份，手动的另算')
  prune(out, 1)
  assert.equal(listBackups(out).length, 2)
  // 核对 + 导入
  const work = join(dataDir, '.import-x')
  const { manifest: m2 } = await inspectBackup(join(out, name), work)
  assert.equal(m2.counts.memories, 1)
  writeFileSync(join(dataDir, 'persona', 'persona.md'), '改过的人格')
  archive.close()
  const { renameSync } = await import('node:fs')
  renameSync(work, join(dataDir, '.pending-import'))
  const applied = await applyPendingImport(dataDir)
  assert.equal(applied.manifest.counts.memories, 1)
  assert.equal(readFileSync(join(dataDir, 'persona', 'persona.md'), 'utf-8'), '你是大肥鱼')
  assert.ok(existsSync(join(dataDir, 'persona', 'history', 'old.md')), '原来的历史版本还在')
  const { readdirSync } = await import('node:fs')
  assert.ok(readdirSync(join(dataDir, 'persona', 'history')).some(n => n.endsWith('.md') && readFileSync(join(dataDir, 'persona', 'history', n), 'utf-8') === '改过的人格'), '被换掉的那版进了历史')
  assert.ok(!m2.files.some(f => f.path === 'media/' + 'd'.repeat(64) + '.png'), '别人存档的图片不在包里')
  assert.ok(existsSync(join(dataDir, 'media', 'd'.repeat(64) + '.png')), '导入时图片只补不删')
  const reopened = new Archive(join(dataDir, 'companion.db'))
  assert.equal(reopened.recent('napcat:GroupMessage:5', 5).length, 1, '别人的存档不在包里，导入时保持原样')
  assert.equal(reopened.recent('napcat:FriendMessage:42', 5).length, 1)
  reopened.close()
  assert.equal(await applyPendingImport(dataDir), undefined, '没有待导入的就不动')
  // 坏包
  writeFileSync(join(dataDir, 'bad.tar.gz'), 'not a tarball')
  await assert.rejects(inspectBackup(join(dataDir, 'bad.tar.gz'), join(dataDir, '.import-bad')))
})

test('备份：按勾选打包；导入时只换勾选的部分，没勾的保持原样；存档换进来后「已整理到哪条」跟着换算', async () => {
  const dataDir = tmp()
  let archive = new Archive(join(dataDir, 'companion.db'))
  let store = new MemoryStore(archive.db)
  mkdirSync(join(dataDir, 'persona'), { recursive: true })
  writeFileSync(join(dataDir, 'persona', 'persona.md'), '人格 A')
  mkdirSync(join(dataDir, 'core'), { recursive: true })
  writeFileSync(join(dataDir, 'core', 'master.md'), '核心 A')
  const M = 'napcat:FriendMessage:42', G = 'napcat:GroupMessage:5'
  archive.setCursor('cat:' + M, 1)
  archive.setCursor('cat:' + G, 3)
  const msg = (umo, text, time) => archive.add({ umo, kind: umo === M ? 'private' : 'group', type: 'message', woke: true, direction: 'in', senderName: 'x', senderId: '1', time, text })
  msg(M, '主人 1', 1000); msg(M, '主人 2', 2000); msg(G, '群 1', 1500)
  const firstId = archive.db.prepare('SELECT MIN(id) AS id FROM messages WHERE umo = ?').get(M).id
  archive.setCursor('org:' + M, firstId) // 整理到第 1 条
  store.add({ scope: 'master', content: '备份时的记忆', writer: 'settings' })
  const out = join(dataDir, 'backups')
  const opts = { dataDir, db: archive.db, outDir: out, plugin: 'x', schema: 5, settings: { a: 1 }, embed: {}, keep: 5 }
  // 只备份人格和桥接设置
  const settingsFiles = { 'companion-core': { ns: 'companion-core', user: { a: 1 } }, 'napcat-bridge': { ns: 'napcat-bridge', user: { b: 2 } }, dsh: {} }
  const small = await createBackup({ ...opts, reason: 'manual', items: ['persona', 'settingsBridge'], settingsFiles })
  assert.deepEqual(small.manifest.items, ['persona', 'settingsBridge'])
  assert.equal(small.manifest.counts.memories, 0)
  assert.equal(small.manifest.counts.archiveMessages, 0)
  assert.equal(small.manifest.counts.masterSessions, 0)
  assert.deepEqual(small.manifest.settings, {}, '没勾插件二的设置')
  const paths = small.manifest.files.map(f => f.path).sort()
  assert.deepEqual(paths, ['persona/persona.md', 'settings/napcat-bridge.json'])
  const smallInspect = await inspectBackup(join(out, small.name), join(dataDir, '.i1'))
  assert.deepEqual(readSavedSettings(smallInspect.dir, ['settingsBridge']), { 'napcat-bridge': { ns: 'napcat-bridge', user: { b: 2 } } })
  // 全备份
  const full = await createBackup({ ...opts, reason: 'manual', items: ['persona', 'core', 'diary', 'memory', 'archiveMaster', 'settingsCompanion'], now: Date.now() + 2000 })
  // 之后数据变了
  writeFileSync(join(dataDir, 'persona', 'persona.md'), '人格 B')
  writeFileSync(join(dataDir, 'core', 'master.md'), '核心 B')
  store.add({ scope: 'master', content: '备份之后的记忆', writer: 'settings' })
  msg(G, '群 2（备份之后）', 3000)
  archive.close()
  // 只还原人格和主人的存档
  const { renameSync } = await import('node:fs')
  const work = (await inspectBackup(join(out, full.name), join(dataDir, '.i2'))).dir
  writeFileSync(join(work, 'restore.json'), JSON.stringify({ items: ['persona', 'archiveMaster'], notes: ['n'] }))
  renameSync(work, join(dataDir, '.pending-import'))
  const applied = await applyPendingImport(dataDir)
  assert.deepEqual(applied.plan.items, ['persona', 'archiveMaster'])
  assert.equal(readFileSync(join(dataDir, 'persona', 'persona.md'), 'utf-8'), '人格 A')
  assert.equal(readFileSync(join(dataDir, 'core', 'master.md'), 'utf-8'), '核心 B', '没勾核心记忆')
  archive = new Archive(join(dataDir, 'companion.db'))
  store = new MemoryStore(archive.db)
  assert.equal(store.list({ scope: 'master', limit: 10 }).items.length, 2, '没勾记忆库，备份之后的记忆还在')
  assert.deepEqual(archive.recent(G, 5).map(m => m.text), ['群 1', '群 2（备份之后）'], '没勾别人的存档')
  assert.deepEqual(archive.recent(M, 5).map(m => m.text), ['主人 1', '主人 2'])
  const ids = archive.db.prepare('SELECT id FROM messages WHERE umo = ? ORDER BY id').all(M).map(r => r.id)
  assert.notEqual(ids[0], firstId, '换进来的消息是新 id')
  assert.equal(archive.cursor('org:' + M), ids[0], '整理进度换算到新的 id')
  assert.equal(archive.cursor('cat:' + M), 1)
  archive.close()
})
