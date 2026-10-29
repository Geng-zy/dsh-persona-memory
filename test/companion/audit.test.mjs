import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Archive } from '../../lib/companion/archive.js'
import { MemoryStore } from '../../lib/companion/memory.js'
import { TextDoc } from '../../lib/companion/docs.js'
import { personaTool } from '../../lib/companion/tools.js'


test('批量读取向量跨越 500 条边界，保持模型过滤、缺失与重复 ID 的行为', () => {
  const a = new Archive(':memory:')
  try {
    const store = new MemoryStore(a.db)
    const ids = []
    const insert = a.db.prepare("INSERT INTO memories (scope,kind,content,importance,trust,writer,created_at,tz,hash) VALUES ('master','fact',?,0.5,1,'settings',0,'UTC',?)")
    for (let i = 0; i < 503; i++) {
      const id = Number(insert.run('记忆 ' + i, 'hash-' + i).lastInsertRowid)
      ids.push(id)
      store.setEmbedding(id, new Float32Array([i, 1]), i === 10 ? 'other' : 'model')
    }
    const vs = store.embeddings('model', [...ids, ids[0], -1])
    assert.equal(vs.size, 502)
    assert.ok(!vs.has(ids[10]))
    assert.deepEqual([...new Float32Array(vs.get(ids[502]).buffer)], [502, 1])
    assert.equal(store.embeddings('model', []).size, 0)
  } finally { a.close() }
})

test('人格审核期间设置页已修改或主人权限已取消，旧稿不能覆盖新稿', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'companion-audit-'))
  try {
    const persona = new TextDoc(join(dir, 'persona.md'), join(dir, 'history'), () => 5)
    let allowed = true, review
    const tool = personaTool({ persona, isMaster: () => allowed, log: () => {}, guardPersona: async () => { review(); return undefined } })
    const run = () => tool.execute({ old_text: '', new_text: '待审核的追加', reason: 'test' }, { agent: { session: { id: 'master' } } })
    persona.write('初稿', { by: 'settings' })
    review = () => persona.write('设置页新稿', { by: 'settings' })
    assert.equal((await run()).ok, false)
    assert.equal(persona.read(), '设置页新稿')
    review = () => { allowed = false }
    assert.equal((await run()).ok, false)
    assert.equal(persona.read(), '设置页新稿')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})




test('模型状态只返回标识与思考等级，不把外部接口密钥带回设置页', async () => {
  const { targetInfo } = await import('../../lib/companion/extract.js')
  assert.deepEqual(targetInfo({ provider: 'api', model: 'm', effort: 'low', api: { url: 'https://example.invalid', key: 'private-test-value', model: 'm' } }), { provider: 'api', model: 'm', effort: 'low' })
  assert.equal(targetInfo(undefined), null)
})
