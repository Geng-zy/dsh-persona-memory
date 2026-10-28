import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Archive } from '../../lib/companion/archive.js'
import { MemoryStore } from '../../lib/companion/memory.js'
import { Care, similarGroups } from '../../lib/companion/care.js'
import { archivedImage } from '../../lib/companion/archived-image.js'

test('存档图片：保留格式回退与内容，拒绝越界路径，缺失文件跳过', () => {
  const dir = mkdtempSync(join(tmpdir(), 'companion-image-'))
  try {
    const hash = 'a'.repeat(64)
    for (const [ext, mime] of [['png', 'image/png'], ['gif', 'image/gif'], ['webp', 'image/webp'], ['jpg', 'image/jpeg'], ['jpeg', 'image/jpeg'], ['bin', 'image/jpeg'], ['constructor', 'image/jpeg']]) {
      writeFileSync(join(dir, hash + '.' + ext), 'image bytes')
      assert.deepEqual(archivedImage(dir, hash + '.' + ext), { type: 'image', mediaType: mime, data: Buffer.from('image bytes').toString('base64') })
    }
    for (const name of [undefined, '../' + hash + '.png', 'nested/' + hash + '.png', hash.toUpperCase() + '.png', 'missing.png', hash + '.bmp']) assert.equal(archivedImage(dir, name), undefined)
    mkdirSync(join(dir, hash + '.directory'))
    assert.throws(() => archivedImage(dir, hash + '.directory'), '读取失败仍由上层处理，不伪装为成功')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('统计查询：空库、混合状态、已遗忘且被取代、不同向量模型保持原有计数', () => {
  const archive = new Archive(':memory:')
  try {
    const store = new MemoryStore(archive.db)
    assert.deepEqual(archive.stats(), { total: 0, byKind: {} })
    assert.deepEqual(store.stats(), { active: 0, forgotten: 0, superseded: 0, tombstones: 0, byScope: {} })
    assert.deepEqual(store.countEmbedded('model-a'), { total: 0, embedded: 0 })
    const a = store.add({ scope: 'master', content: 'Alpha', writer: 'settings' }).id
    const b = store.add({ scope: 'user:7', content: 'Beta', writer: 'settings' }).id
    const c = store.add({ scope: 'group:9', content: 'Gamma', writer: 'settings' }).id
    store.forget(b)
    archive.db.prepare('UPDATE memories SET superseded_by = ? WHERE id = ?').run(a, b)
    store.setEmbedding(a, new Float32Array([1, 0]), 'model-a')
    store.setEmbedding(b, new Float32Array([0, 1]), 'model-b')
    assert.deepEqual(store.stats(), { active: 2, forgotten: 1, superseded: 1, tombstones: 0, byScope: { master: 1, group: 1 } })
    assert.deepEqual(store.countEmbedded('model-a'), { total: 3, embedded: 1 })
    assert.deepEqual(store.countEmbedded('model-b'), { total: 3, embedded: 1 })
    assert.deepEqual(store.countEmbedded('missing'), { total: 3, embedded: 0 })
    store.purge(c)
    assert.equal(store.stats().tombstones, 1)
    const message = { umo: 'test', kind: 'private', senderId: '7', senderName: 'peer', type: 'message', woke: true, text: 'hi' }
    archive.add({ ...message, time: 2000, direction: 'in' })
    archive.add({ ...message, time: 1000, direction: 'out' })
    assert.deepEqual(archive.stats(), { total: 2, byKind: { private: 2 }, oldest: 1000, newest: 2000 })
  } finally { archive.close() }
})

test('自动清理：超过两页的数据均处理，首尾不漏，不受删除时分页变化影响', () => {
  const archive = new Archive(':memory:')
  try {
    const store = new MemoryStore(archive.db)
    const now = Date.now()
    for (let i = 0; i < 405; i++) store.add({ scope: 'user:' + i, content: 'memory ' + i, importance: 0, writer: 'settings' })
    archive.db.prepare('UPDATE memories SET created_at = ?').run(now - 100 * 86400000)
    const care = new Care({ db: archive.db, store, llm: () => undefined, target: () => undefined, log: () => {}, settings: () => ({ cleanupEnabled: true, cleanupDays: 90, cleanupImportance: 0.2, halfLifeDays: 30, purgeForgottenEnabled: false, forgetMode: () => 'purge' }) })
    assert.deepEqual(care.cleanup(now), { forgotten: 0, purged: 405 })
    assert.equal(store.list({ status: 'all' }).total, 0)
    assert.equal(store.stats().tombstones, 405)
  } finally { archive.close() }
})

test('相近记忆分组：归属隔离、输入顺序、单组八条和组数上限保持', () => {
  const items = []
  for (let i = 0; i < 10; i++) {
    items.push({ id: i + 1, scope: 'a', content: 'shared text' })
    if (i < 2) items.push({ id: i + 20, scope: 'b', content: 'shared text' })
  }
  const groups = similarGroups(items, 1, 2)
  assert.deepEqual(groups.map(g => g.map(m => m.id)), [[1, 2, 3, 4, 5, 6, 7, 8], [20, 21]])
  assert.equal(similarGroups(items, 1, 1).length, 1)
  assert.deepEqual(similarGroups(items, 1, 0), [])
})

test('批量关键词评分：重复词、停用词、全角/中文、空查询与缺失记录的结果一致', async () => {
  const { buildIndex, keywordScore, keywordScorer } = await import('../../lib/companion/text.js')
  const index = buildIndex([{ id: 1, content: '主人喜欢苹果 apple' }, { id: 2, content: '今天我们一起吃了香蕉' }, { id: 3, content: 'ＡＰＰＬＥ 2026 apple' }])
  // 固定期望值来自重构前版本，避免只比较两个共用实现的接口。
  const cases = [
    ['', [0, 0, 0, 0]],
    ['苹果 苹果 apple', [1, 0, 0.430676558073393, 0]],
    ['今天我们', [0, 1, 0, 0]],
    ['ＡＰＰＬＥ', [1, 0, 1, 0]],
    ['主人 2026 香蕉', [1 / 3, 1 / 3, 1 / 3, 0]],
  ]
  for (const [query, expected] of cases) {
    const score = keywordScorer(index, query)
    for (const [i, id] of [1, 2, 3, 999].entries()) assert.ok(Math.abs(score(id) - expected[i]) < 1e-14)
  }
  assert.equal(keywordScore(index, 'apple', 1), 1)
  assert.equal(keywordScorer(index, 'apple')(1), 1)
  assert.equal(keywordScorer(index, '')(1), 0)
  assert.equal(keywordScorer(index, 'banana')(999), 0)
})
