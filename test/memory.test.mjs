// 单元测试：关键词切分和打分、记忆写入（去重、取代、指纹挡回写）、遗忘和恢复、召回（隔离、折扣、门槛、向量）、
// 模型输出解析、向量索引任务（假接口）、整理（假模型、只整理没整理过的部分）、群里没看到的消息。
// 用法：node --test test/（先 pnpm run build）
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { Archive } from '../lib/archive.js'
import { Indexer, embed } from '../lib/embed.js'
import { parseCleanup, parseExtracted } from '../lib/extract.js'
import { MemoryStore, ownScope, visibleScopes } from '../lib/memory.js'
import { Organizer, transcriptOf } from '../lib/organizer.js'
import { effectiveImportance, formatRecall, recall } from '../lib/recall.js'
import { forgetMode } from '../lib/rules.js'
import { buildIndex, cosine, fingerprint, keywordScore, overlap, tokens } from '../lib/text.js'

const fresh = () => {
  const archive = new Archive(':memory:')
  return { archive, store: new MemoryStore(archive.db, () => 'Asia/Shanghai') }
}
const S = { topK: 6, keywordThreshold: 0.3, vectorThreshold: 0.45, keywordWeight: 0.3, importanceWeight: 0.2, recencyWeight: 0.1, groupDiscount: 0.7, halfLifeDays: 30 }
const master = { category: 'master', qq: false }
const group = { category: 'group', qq: true, groupId: '555' }
const other = { category: 'private', qq: true, userId: '8' }

test('切词和打分：中文两字一组、英文按词；少见的词更重要', () => {
  assert.deepEqual(tokens('主人爱吃 Red肉'), ['主人', '人爱', '爱吃', 'red', '肉'])
  assert.equal(fingerprint('主人爱吃红烧肉！'), fingerprint(' 主人 爱吃红烧肉'))
  const idx = buildIndex([{ id: 1, content: '主人最爱吃红烧肉' }, { id: 2, content: '主人下周三面试' }, { id: 3, content: '群友说今天下雨' }])
  assert.ok(keywordScore(idx, '主人爱吃什么肉', 1) > keywordScore(idx, '主人爱吃什么肉', 2))
  assert.equal(keywordScore(idx, '完全无关', 1), 0)
  assert.ok(overlap('主人最爱吃红烧肉', '主人最爱吃红烧肉。') > 0.9)
  assert.ok(Math.abs(cosine(Float32Array.from([1, 0]), Float32Array.from([1, 0])) - 1) < 1e-6)
})

test('写入：几乎一样的合并、取代旧的、彻底遗忘过的不再写回来', () => {
  const { store } = fresh()
  const a = store.add({ scope: 'master', content: '主人住在上海', importance: 0.5, writer: 'organize' })
  assert.equal(a.action, 'added')
  const merged = store.add({ scope: 'master', content: '主人住在上海。', importance: 0.6, writer: 'self' })
  assert.deepEqual(merged, { action: 'merged', id: a.id })
  assert.ok(store.get(a.id).importance > 0.6)
  const b = store.add({ scope: 'master', content: '主人搬到北京了', writer: 'organize', replaces: '主人住在上海' })
  assert.equal(b.superseded, a.id)
  assert.deepEqual(store.active(['master']).map(m => m.content), ['主人搬到北京了'])
  assert.equal(store.add({ scope: 'master', content: '  ', writer: 'x' }).action, 'empty')
  assert.equal(store.purge(b.id), true)
  assert.equal(store.get(a.id).supersededBy, undefined, '取代它的那条删了，旧的不再算被取代')
  assert.equal(store.add({ scope: 'master', content: '主人搬到北京了！', writer: 'organize' }).action, 'blocked')
  assert.equal(store.add({ scope: 'group:1', content: '主人搬到北京了', writer: 'organize' }).action, 'added', '指纹按归属分开')
})

test('遗忘：普通遗忘可以恢复；列表按状态筛；统计', () => {
  const { store } = fresh()
  const { id } = store.add({ scope: 'master', content: '主人喜欢猫', writer: 'settings' })
  store.add({ scope: 'group:555', content: '群里在聊游戏', writer: 'organize' })
  assert.equal(store.forget(id), true)
  assert.equal(store.list({ status: 'forgotten' }).total, 1)
  assert.equal(store.list({ status: 'active', scope: 'group:*' }).total, 1)
  assert.equal(store.list({ q: '猫', status: 'all' }).total, 1)
  assert.equal(store.restore(id), true)
  assert.deepEqual(store.stats().byScope, { master: 1, group: 1 })
})

test('召回：主人能想起群里的（打折），群里想不起主人的，别人私聊只想起自己的和公开的', () => {
  const { store } = fresh()
  store.add({ scope: 'master', content: '主人最爱吃红烧肉', importance: 0.8, writer: 'organize' })
  store.add({ scope: 'public', content: '我是一条爱吃红烧肉的鱼', importance: 0.5, writer: 'settings' })
  store.add({ scope: 'group:555', content: '群友小王也爱吃红烧肉', importance: 0.5, writer: 'organize' })
  store.add({ scope: 'user:8', content: '这个人不吃红烧肉', importance: 0.5, writer: 'organize' })
  const q = '红烧肉'
  assert.deepEqual(recall(store, master, q, S).map(r => r.memory.scope).sort(), ['group:555', 'master', 'public'])
  assert.deepEqual(recall(store, group, q, S).map(r => r.memory.scope).sort(), ['group:555', 'public'])
  assert.deepEqual(recall(store, other, q, S).map(r => r.memory.scope).sort(), ['public', 'user:8'])
  assert.equal(recall(store, master, q, S)[0].memory.scope, 'master')
  assert.deepEqual(recall(store, master, '今天天气', S), [], '不相关的不召回')
  assert.equal(recall(store, master, q, { ...S, topK: 1 }).length, 1)
  assert.match(formatRecall(recall(store, master, q, S)), /<memory>[\s\S]*主人最爱吃红烧肉[\s\S]*在群 555 里[\s\S]*<\/memory>/)
  assert.deepEqual(visibleScopes(other).scopes, ['user:8', 'public'])
  assert.equal(ownScope(group), 'group:555')
})

test('召回：有向量时按综合相似度；重要程度随时间衰减', () => {
  const { store } = fresh()
  const a = store.add({ scope: 'master', content: '主人养了一只猫叫咪咪', writer: 'organize' })
  const b = store.add({ scope: 'master', content: '主人在学吉他', writer: 'organize' })
  store.setEmbedding(a.id, Float32Array.from([1, 0, 0]), 'm')
  store.setEmbedding(b.id, Float32Array.from([0, 1, 0]), 'm')
  const got = recall(store, master, '那只宠物', S, { query: Float32Array.from([0.9, 0.1, 0]), model: 'm' })
  assert.deepEqual(got.map(r => r.memory.id), [a.id], '字面不沾边也能靠向量想起来')
  const m = store.get(a.id)
  assert.ok(effectiveImportance(m, 30, m.createdAt + 30 * 86400000) < m.importance * 0.51)
})

test('解析模型输出：容忍代码块和废话；清理只接受给出的编号', () => {
  const out = parseExtracted('好的：\n```json\n[{"content":"主人爱吃肉","kind":"preference","importance":0.9},{"content":"","kind":"x"},{"content":"搬家了","kind":"bad","importance":5,"replaces":"住上海"}]\n```')
  assert.deepEqual(out, [
    { content: '主人爱吃肉', kind: 'preference', importance: 0.9 },
    { content: '搬家了', kind: 'other', importance: 1, replaces: '住上海' },
  ])
  assert.deepEqual(parseExtracted('没有 JSON'), [])
  assert.deepEqual(parseCleanup('[{"id":3,"reason":"重复"},{"id":99},{"id":3}]', new Set([3, 4])), [{ id: 3, reason: '重复' }])
})

test('遗忘方式：默认主人普通、其他彻底，例外规则可改', () => {
  const defaults = { context: {}, archive: {}, forget: { master: 'normal', private: 'purge', group: 'purge' } }
  assert.equal(forgetMode(master, defaults, []), 'normal')
  assert.equal(forgetMode(group, defaults, []), 'purge')
  assert.equal(forgetMode(group, defaults, [{ target: '555', kind: 'group', forgetMode: 'normal' }]), 'normal')
})

/** 假的向量接口：按文字长度给个向量；fail 次数内返回错误。 */
function fakeEmbedFetch(opts = {}) {
  let calls = 0
  return async (_url, init) => {
    calls += 1
    if (opts.failAll) return new Response('nope', { status: 500 })
    const { input } = JSON.parse(init.body)
    return new Response(JSON.stringify({ data: input.map((t, index) => ({ index, embedding: [t.length, 1, 0] })) }))
  }
}

test('向量：接口调用、索引任务补算、换模型自动补、手动重建、失败会停', async () => {
  const vectors = await embed(['ab', 'abc'], { apiUrl: 'https://x/v1', apiKey: 'k', model: 'm', batch: 8 }, fakeEmbedFetch())
  assert.deepEqual([...vectors[1]], [3, 1, 0])
  const { store } = fresh()
  for (const c of ['一', '二二', '三三三']) store.add({ scope: 'master', content: c + '的记忆内容', writer: 'organize' })
  const metaMap = new Map()
  const meta = { get: k => metaMap.get(k), set: (k, v) => metaMap.set(k, v) }
  let settings = { apiUrl: 'https://x/v1', apiKey: '', model: 'm1', batch: 2 }
  const idx = new Indexer(store, () => settings, meta, () => {}, fakeEmbedFetch())
  idx.ensure()
  assert.equal(idx.state().state, 'disabled', '没有 Key 不启用')
  settings = { ...settings, apiKey: 'k' }
  idx.ensure()
  await idx.idle()
  assert.equal(idx.state().state, 'done')
  assert.equal(idx.state().embedded, 3)
  assert.equal(idx.state().dim, 3)
  settings = { ...settings, model: 'm2' }
  assert.equal(idx.state().embedded, 0, '换了模型，旧向量不算')
  idx.ensure()
  await idx.idle()
  assert.equal(idx.state().embedded, 3)
  idx.start(true)
  await idx.idle()
  assert.equal(idx.state().done, 3)
  const bad = new Indexer(store, () => ({ ...settings, model: 'm3', batch: 8 }), meta, () => {}, fakeEmbedFetch({ failAll: true }))
  bad.start(false)
  await bad.idle()
  assert.equal(bad.state().state, 'failed')
  assert.match(bad.state().lastError, /HTTP 500/)
})

/** 假模型服务：记下提示词，回一段 JSON。 */
function fakeLlm(reply) {
  const prompts = []
  return {
    prompts,
    stream: async function* (options) {
      prompts.push(options.messages[0].content[0].text)
      yield { type: 'text-delta', text: reply }
      yield { type: 'finish', finish: { kind: 'stop' } }
    },
  }
}

test('群里最近的消息：含她自己说的和唤醒过她的，不含正在处理的这条', () => {
  const { archive } = fresh()
  const umo = 'napcat:GroupMessage:555'
  const base = { umo, kind: 'group', groupId: '555', senderId: '9', senderName: '群友', type: 'message' }
  archive.add({ ...base, messageId: '1', time: 1000, direction: 'in', woke: false, text: '很早的' })
  archive.add({ ...base, time: 2000, direction: 'out', woke: true, text: '她说过话', senderId: 'self' })
  archive.add({ ...base, messageId: '2', time: 3000, direction: 'in', woke: false, text: '之后的一条' })
  archive.add({ ...base, messageId: '3', time: 4000, direction: 'in', woke: true, text: '@她的上一条' })
  archive.add({ ...base, messageId: '4', time: 5000, direction: 'in', woke: false, text: '又一条' })
  archive.add({ ...base, messageId: '5', time: 6000, direction: 'in', woke: true, text: '正在处理的' })
  assert.deepEqual(archive.lastMessages(umo, 10, '5').map(m => m.text), ['很早的', '她说过话', '之后的一条', '@她的上一条', '又一条'])
  assert.deepEqual(archive.lastMessages(umo, 2, '5').map(m => m.text), ['@她的上一条', '又一条'])
  assert.equal(archive.lastOutTime(umo), 2000)
})

test('整理：只整理没整理过的部分；记到会话自己的归属；没有模型时不动进度', async () => {
  const { archive, store } = fresh()
  const umo = 'napcat:FriendMessage:42'
  const base = { umo, kind: 'private', userId: '42', senderId: '42', senderName: '主人', type: 'message', woke: true, direction: 'in' }
  archive.add({ ...base, messageId: '1', time: Date.now(), text: '我最喜欢的水果是芒果' })
  archive.add({ ...base, time: Date.now(), direction: 'out', senderId: 'self', senderName: '她', text: '记住啦' })
  assert.match(transcriptOf(archive.recent(umo, 5)).join('\n'), /主人\(42\)：我最喜欢的水果是芒果[\s\S]*我：记住啦/)
  let model
  const llm = fakeLlm('[{"content":"主人最喜欢的水果是芒果","kind":"preference","importance":0.7}]')
  let writes = 0
  const org = new Organizer({ archive, store, llm: () => llm, target: () => model, log: () => {}, afterWrite: () => { writes += 1 } })
  await assert.rejects(org.organizeUmo(umo, '测试'), /没有可用的模型/)
  assert.equal(archive.cursor('org:' + umo), 0, '失败时不往后挪')
  model = { provider: 'p', model: 'm' }
  org.rememberCategory(umo, 'master')
  assert.equal(await org.organizeUmo(umo, '测试'), 1)
  assert.equal(store.active(['master'])[0].content, '主人最喜欢的水果是芒果')
  assert.equal(writes, 1)
  assert.match(llm.prompts[0], /你和主人的私聊/)
  assert.equal(await org.organizeUmo(umo, '再来一次'), 0)
  assert.equal(llm.prompts.length, 1, '没有新消息时不调用模型')
  assert.deepEqual(org.pending(), { qqSessions: 0, qqMessages: 0, dshSessions: 0 })
  // dsh 会话：攒够轮数自动整理
  org.onDshLine('s1', '今天加班好累', true, 2)
  org.onDshLine('s1', '辛苦啦', false, 2)
  assert.equal(org.pending().dshSessions, 1)
  org.onDshLine('s1', '明天还要早起', true, 2)
  await org.idle()
  assert.equal(llm.prompts.length, 2)
  assert.match(llm.prompts[1], /主人：今天加班好累[\s\S]*我：辛苦啦[\s\S]*主人：明天还要早起/)
  assert.equal(org.pending().dshSessions, 0)
  assert.equal(await org.flushDsh('s1', '没有新内容'), 0)
})

test('向量接口的测试按钮：通了报模型和维度；Key 不对、没填时说原因，错误里不带 Key', async () => {
  const { testEmbed } = await import('../lib/embed.js')
  const s = { apiUrl: 'https://x.example/v1', apiKey: 'good', model: 'BAAI/bge-m3', batch: 16 }
  const fake = async (url, init) => {
    const auth = init.headers.authorization
    if (auth !== 'Bearer good') return new Response('{"message":"Invalid token"}', { status: 401 })
    return new Response(JSON.stringify({ data: [{ index: 0, embedding: new Array(1024).fill(0.1) }] }), { status: 200 })
  }
  const ok = await testEmbed(s, fake)
  assert.equal(ok.ok, true); assert.equal(ok.dim, 1024); assert.equal(ok.model, 'BAAI/bge-m3')
  const bad = await testEmbed({ ...s, apiKey: 'wrong-key-123' }, fake)
  assert.equal(bad.ok, false); assert.match(bad.error, /HTTP 401/); assert.doesNotMatch(bad.error, /wrong-key-123/)
  assert.deepEqual(await testEmbed({ ...s, apiKey: '' }, fake), { ok: false, error: '还没填 Key' })
})
