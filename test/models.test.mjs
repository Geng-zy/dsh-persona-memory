// 单元测试：设置页「获取模型列表」（假的接口，不联网）。dsh-companion-core 里有一份一样的。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { listModels } from '../lib/models.js'

const fakeFetch = (status, body, seen = {}) => async (url, init) => {
  seen.url = url; seen.auth = init?.headers?.authorization
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
}

test('获取模型列表：按用途挑、带上查询串和 Key、Gemini 的 models/ 前缀去掉', async () => {
  const seen = {}
  const r = await listModels('https://api.example.com/v1/', 'sk-1', 'embedding', '?sub_type=embedding',
    fakeFetch(200, { data: [{ id: 'deepseek-chat' }, { id: 'BAAI/bge-m3' }, { id: 'models/gemini-embedding-001' }, { id: 'Qwen/Qwen3-Embedding-8B' }] }, seen))
  assert.equal(seen.url, 'https://api.example.com/v1/models?sub_type=embedding')
  assert.equal(seen.auth, 'Bearer sk-1')
  assert.deepEqual(r, { ok: true, models: ['BAAI/bge-m3', 'gemini-embedding-001', 'Qwen/Qwen3-Embedding-8B'], filtered: true, total: 4 })
  const stt = await listModels('https://api.example.com/v1', '', 'stt', '', fakeFetch(200, { data: [{ id: 'whisper-large-v3' }, { id: 'llama-3' }] }, seen))
  assert.deepEqual(stt.models, ['whisper-large-v3'])
  assert.equal(seen.auth, undefined, '没 Key 就不带')
  const all = await listModels('https://x/v1', 'k', 'stt', '', fakeFetch(200, { data: [{ id: 'm1' }, { id: 'm2' }] }))
  assert.deepEqual(all, { ok: true, models: ['m1', 'm2'], filtered: false, total: 2 }, '看不出用途就全给')
})

test('获取模型列表：Key 不对、不支持、地址不对都给出能看懂的原因', async () => {
  const bad = await listModels('https://x/v1', 'k', 'embedding', '', fakeFetch(401, 'invalid key'))
  assert.equal(bad.ok, false); assert.match(bad.error, /401.*Key 不对/)
  const none = await listModels('https://x/v1', 'k', 'embedding', '', fakeFetch(404, ''))
  assert.match(none.error, /不支持列出模型/)
  assert.equal((await listModels('x/v1', 'k', 'embedding')).ok, false)
  assert.equal((await listModels('https://x/v1', 'k', 'embedding', '', fakeFetch(200, { data: [] }))).ok, false)
})
