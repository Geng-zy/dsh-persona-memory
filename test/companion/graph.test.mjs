// 单元测试：图记忆（解析模型输出、存关系网、按会话隔离、顺着关系召回、两路融合、后台补抽、改内容重抽、删记忆清理）。
// 用法：node --test test/（先 pnpm run build）
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { Archive } from '../../lib/companion/archive.js'
import { GraphBuilder, GraphStore, graphScores, parseGraph } from '../../lib/companion/graph.js'
import { MemoryStore } from '../../lib/companion/memory.js'
import { recall } from '../../lib/companion/recall.js'

const SETTINGS = { topK: 6, keywordThreshold: 0.3, vectorThreshold: 0.45, keywordWeight: 0.3, importanceWeight: 0.2, recencyWeight: 0.1, groupDiscount: 0.7, halfLifeDays: 30 }
const MASTER = { category: 'master', qq: false }

function fakeLlm(reply) {
  const calls = []
  return { calls, stream: async function* (o) { calls.push(o.messages[0].content[0].text); yield { type: 'text-delta', text: typeof reply === 'function' ? reply(o.messages[0].content[0].text) : reply }; yield { type: 'finish', finish: { kind: 'stop' } } } }
}

test('解析：只认这批里的记忆，关系两端补成实体，自己指向自己的丢掉，包在 ```json 里也行', () => {
  const text = '好的\n```json\n[{"id": 1, "entities": [{"name": "咪咪", "kind": "动物"}], "relations": [{"src": "主人", "rel": "养了", "dst": "咪咪"}, {"src": "咪咪", "rel": "是", "dst": "咪咪"}]}, {"id": 99, "entities": [{"name": "别的"}]}]\n```'
  const got = parseGraph(text, [1, 2])
  assert.equal(got.length, 1)
  assert.deepEqual(got[0].entities.map(e => e.name).sort(), ['主人', '咪咪'])
  assert.equal(got[0].relations.length, 1)
  assert.throws(() => parseGraph('没有 JSON', [1]), /JSON/)
})

function setup() {
  const archive = new Archive(':memory:')
  const store = new MemoryStore(archive.db)
  const graph = new GraphStore(archive.db)
  return { archive, store, graph }
}

test('顺着关系想起来：聊「咪咪」能想起没出现「咪咪」的「主人的猫」那条；群里看不到主人的关系网', () => {
  const { archive, store, graph } = setup()
  const cat = store.add({ scope: 'master', content: '主人养了一只橘猫，叫咪咪', importance: 0.6, writer: 'organize' })
  const vet = store.add({ scope: 'master', content: '那只橘猫上周去看了兽医，打了疫苗', importance: 0.5, writer: 'organize' })
  const other = store.add({ scope: 'master', content: '主人喜欢吃红烧肉', importance: 0.6, writer: 'organize' })
  const hash = id => archive.db.prepare('SELECT hash FROM memories WHERE id = ?').get(id).hash
  graph.save({ id: cat.id, scope: 'master', hash: hash(cat.id) }, { id: cat.id, entities: [{ name: '主人', kind: '人' }, { name: '橘猫', kind: '动物' }, { name: '咪咪', kind: '动物' }], relations: [{ src: '主人', rel: '养了', dst: '橘猫' }, { src: '橘猫', rel: '名字是', dst: '咪咪' }] })
  graph.save({ id: vet.id, scope: 'master', hash: hash(vet.id) }, { id: vet.id, entities: [{ name: '橘猫', kind: '动物' }, { name: '兽医', kind: '人' }], relations: [{ src: '橘猫', rel: '看了', dst: '兽医' }] })
  graph.save({ id: other.id, scope: 'master', hash: hash(other.id) }, { id: other.id, entities: [{ name: '主人', kind: '人' }, { name: '红烧肉', kind: '食物' }], relations: [{ src: '主人', rel: '喜欢吃', dst: '红烧肉' }] })

  const q = '咪咪最近怎么样'
  const scores = graphScores(graph, MASTER, q, 1)
  assert.ok(scores.get(cat.id) > 0)
  assert.ok(scores.get(vet.id) > 0, '「咪咪 —名字是— 橘猫」走一步就到兽医那条')
  const withoutGraph = recall(store, MASTER, q, SETTINGS)
  assert.ok(!withoutGraph.some(r => r.memory.id === vet.id), '只用关键词想不起兽医那条')
  const withGraph = recall(store, MASTER, q, SETTINGS, undefined, Date.now(), scores)
  assert.ok(withGraph.some(r => r.memory.id === vet.id), '加上图那一路就想起来了')
  assert.ok(withGraph.length <= SETTINGS.topK)
  assert.equal(graphScores(graph, MASTER, q, 0).get(vet.id), undefined, '走 0 步时只有直接提到的')
  assert.equal(graphScores(graph, { category: 'group', qq: true, umo: 'snowluma:GroupMessage:5', groupId: '5' }, q, 1).size, 0, '群里看不到主人的关系网')
  assert.deepEqual(graph.counts(), { memories: 3, done: 3, entities: 5, relations: 4 })
})

test('后台补抽：批量调模型、进度、改内容会重抽、删掉的记忆清理干净；日记不抽', async () => {
  const { store, graph } = setup()
  const a = store.add({ scope: 'master', content: '主人在杭州上班', importance: 0.6, writer: 'organize' })
  const b = store.add({ scope: 'user:7', content: '小王养了一条狗叫旺财', importance: 0.5, writer: 'organize' })
  store.add({ scope: 'master', kind: 'diary', content: '# 10月24日\n今天很开心', importance: 0.5, writer: 'diary' })
  const llm = fakeLlm(prompt => JSON.stringify([...prompt.matchAll(/^#(\d+) (.*)$/gm)].map(([, id, content]) => {
    if (content.includes('杭州')) return { id: Number(id), entities: [], relations: [{ src: '主人', rel: '在…上班', dst: content.includes('上海') ? '上海' : '杭州' }] }
    if (content.includes('上海')) return { id: Number(id), entities: [], relations: [{ src: '主人', rel: '在…上班', dst: '上海' }] }
    return { id: Number(id), entities: [], relations: [{ src: '小王', rel: '养了', dst: '旺财' }] }
  })))
  let enabled = true
  const builder = new GraphBuilder(graph, { settings: () => ({ enabled, batch: 8, hops: 1 }), llm: () => llm, target: () => ({ provider: 'p', model: 'm' }), embedSettings: () => ({ apiUrl: '', apiKey: '', model: '', batch: 16 }), log: () => {} })
  builder.ensure()
  await builder.idle()
  assert.equal(llm.calls.length, 1, '两条记忆一次调完')
  assert.ok(!llm.calls[0].includes('今天很开心'), '日记不抽')
  assert.equal(builder.state().state, 'done')
  assert.deepEqual(builder.state().counts, { memories: 2, done: 2, entities: 4, relations: 2 })
  assert.ok(graphScores(graph, { category: 'private', qq: true, umo: 'snowluma:FriendMessage:7', userId: '7' }, '旺财今天乖不乖', 1).has(b.id))

  // 改内容：指纹变了，重抽，旧关系去掉
  store.edit(a.id, '主人换到上海上班了')
  builder.ensure()
  await builder.idle()
  assert.equal(llm.calls.length, 2)
  assert.deepEqual(graph.sample(10).filter(r => r.memory === a.id).map(r => r.dst), ['上海'])

  // 彻底遗忘：关系和没人提到的实体清掉
  store.purge(b.id)
  graph.tidy()
  assert.deepEqual(graph.counts(), { memories: 1, done: 1, entities: 2, relations: 1 })

  // 关掉：状态是 disabled，不再自动补
  enabled = false
  store.add({ scope: 'master', content: '主人周末去爬山', importance: 0.5, writer: 'organize' })
  builder.ensure()
  await builder.idle()
  assert.equal(llm.calls.length, 2)
  assert.equal(builder.state().state, 'disabled')
})

test('模型连续出错：单条记下跳过，连续失败三次就停，设置页能看到错误', async () => {
  const { store, graph } = setup()
  store.add({ scope: 'master', content: '主人喜欢下雨天', importance: 0.6, writer: 'organize' })
  const llm = fakeLlm('我不知道')
  const builder = new GraphBuilder(graph, { settings: () => ({ enabled: true, batch: 8, hops: 1 }), llm: () => llm, target: () => ({ provider: 'p', model: 'm' }), embedSettings: () => ({ apiUrl: '', apiKey: '', model: '', batch: 16 }), log: () => {} })
  builder.start(false)
  await builder.idle()
  const st = builder.state()
  assert.equal(st.state, 'done', '唯一一条失败后被跳过，任务正常结束')
  assert.equal(st.errors.length, 1)
  assert.match(st.lastError, /JSON/)
})
