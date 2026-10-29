// 单元测试：主动聊天（免打扰、随机间隔、她刚说过话不触发、只找最近聊过的、群聊带上下文）、
// 自动清理、定期整合和撤销、备份打包/列表/核对/导入替换。
// 用法：node --test test/（先 pnpm run build）
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { Archive } from '../../lib/companion/archive.js'
import { applyPendingImport, createBackup, inspectBackup, listBackups, prune, readSavedSettings } from '../../lib/companion/backup.js'
import { Care, similarGroups } from '../../lib/companion/care.js'
import { MemoryStore } from '../../lib/companion/memory.js'
import { Organizer } from '../../lib/companion/organizer.js'


const MIN = 60_000
const DAY = 86_400_000
const tmp = () => mkdtempSync(join(tmpdir(), 'companion-p4-'))









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

test('备份：打包（不含别人的存档、不含 Key）、列表、合计保留几份、核对、导入替换', async () => {
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
  archive.setCursor('cat:snowluma:FriendMessage:42', 1)
  archive.add({ umo: 'snowluma:FriendMessage:42', kind: 'private', userId: '42', type: 'message', woke: true, direction: 'in', senderName: '主人', senderId: '42', time: 1000, text: '主人的话', segments: JSON.stringify([{ type: 'Image', _local: img }]) })
  archive.add({ umo: 'snowluma:GroupMessage:5', kind: 'group', groupId: '5', type: 'message', woke: true, direction: 'in', senderName: '群友', senderId: '9', time: 2000, text: '群里的话', segments: JSON.stringify([{ type: 'Image', _local: 'd'.repeat(64) + '.png' }]) })
  store.add({ scope: 'master', content: '主人爱吃红烧肉', writer: 'settings' })
  const out = join(dataDir, 'backups')
  const opts = { dataDir, db: archive.db, outDir: out, plugin: '0.4.0', schema: 4, settings: { recallTopK: 6 }, embed: { model: 'm', dim: 4 }, keep: 2 }
  const { name, manifest } = await createBackup({ ...opts, reason: 'manual', now: Date.parse('2026-10-24T10:00:00Z') })
  // 文件名用本地时间
  const d = new Date(Date.parse('2026-10-24T10:00:00Z')), p2 = n => String(n).padStart(2, '0')
  assert.equal(name, 'persona-memory-manual-' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + p2(d.getHours()) + p2(d.getMinutes()) + '00.tar.gz')
  assert.deepEqual(manifest.counts, { memories: 1, diaryDays: 1, months: 0, archiveMessages: 0, media: 0, masterSessions: 0 })
  assert.ok(!manifest.items.includes('sessionsMaster'), '默认不带原始会话')
  assert.ok(!JSON.stringify(manifest).includes('embedApiKey'))
  assert.ok(!manifest.files.some(f => f.path.includes('history')), '不带历史版本')
  for (let i = 1; i <= 3; i++) await createBackup({ ...opts, reason: 'auto', now: Date.parse('2026-10-2' + i + 'T04:00:00Z') })
  assert.deepEqual(listBackups(out).map(b => b.reason).sort(), ['auto', 'manual'], '自动与手动合计仅留最新2份')
  prune(out, 1)
  assert.equal(listBackups(out).length, 1)
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
  assert.equal(reopened.recent('snowluma:GroupMessage:5', 5).length, 1, '别人的存档不在包里，导入时保持原样')
  assert.equal(reopened.recent('snowluma:FriendMessage:42', 5).length, 1)
  reopened.close()
  assert.equal(await applyPendingImport(dataDir), undefined, '没有待导入的就不动')
  // 坏包
  writeFileSync(join(dataDir, 'bad.tar.gz'), 'not a tarball')
  await assert.rejects(inspectBackup(join(dataDir, 'bad.tar.gz'), join(dataDir, '.import-bad')))
})




test('备份保留：三类合计只保留最新五份，不清理临时文件或无关文件；备份失败不删已有包', async () => {
  const dir = tmp(), out = join(dir, 'backups')
  mkdirSync(out)
  const names = []
  for (let i = 1; i <= 8; i++) {
    const name = 'companion-' + ['auto', 'manual', 'before-import'][i % 3] + '-20261029-00000' + i + '.tar.gz'
    writeFileSync(join(out, name), 'fixture-' + i); names.push(name)
  }
  writeFileSync(join(out, 'in-progress.tar.gz.part'), 'keep temporary')
  writeFileSync(join(out, 'notes.txt'), 'keep unrelated')
  prune(out, 5)
  assert.deepEqual(listBackups(out).map(x => x.name), names.slice(-5).reverse())
  assert.equal(readFileSync(join(out, 'in-progress.tar.gz.part'), 'utf8'), 'keep temporary')
  assert.equal(readFileSync(join(out, 'notes.txt'), 'utf8'), 'keep unrelated')
  const archive = new Archive(join(dir, 'companion.db'))
  const created = await createBackup({ dataDir: dir, db: archive.db, outDir: out, reason: 'manual', plugin: 'test', schema: 5,
    settings: {}, embed: {}, keep: 5, items: ['persona'], now: Date.parse('2026-10-30T01:00:00Z') })
  const newest = [created.name, ...names.slice(-4).reverse()]
  assert.deepEqual(listBackups(out).map(x => x.name), newest, '满五份时新包生成成功后淘汰三类合计最早的一份')
  archive.close()
  await assert.rejects(createBackup({ dataDir: dir, db: archive.db, outDir: out, reason: 'manual', plugin: 'test', schema: 5,
    settings: {}, embed: {}, keep: 5, items: ['memory'] }))
  assert.deepEqual(listBackups(out).map(x => x.name), newest, '未成功生成新包时五份原备份均保留')
})
