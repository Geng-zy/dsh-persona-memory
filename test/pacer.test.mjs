// 单元测试：发消息的节奏（打字速度、群里的发言频率、同一会话按顺序、等太久不发）。
// 用法：node --test test/（先 pnpm run build）
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { Pacer, rateDelay, typingDelay } from '../lib/pacer.js'

const S = { typingPrivate: true, typingGroup: true, charsPerMinute: 20, typingMinSeconds: 2, typingMaxSeconds: 30, groupMinGapSeconds: 5, groupMaxPerWindow: 3, groupWindowSeconds: 60, maxWaitSeconds: 120 }

test('打字速度：一分钟 20 个字时 5 个字等 15 秒；有最短、最长；关掉不等；空白不算字', () => {
  assert.equal(typingDelay('你好呀朋友', false, S), 15_000)
  assert.equal(typingDelay('嗯', false, S), 3_000)
  assert.equal(typingDelay('嗯', false, { ...S, typingMinSeconds: 5 }), 5_000, '最短 5 秒')
  assert.equal(typingDelay('字'.repeat(200), true, S), 30_000, '最长 30 秒')
  assert.equal(typingDelay('你 好\n呀', false, S), 9_000)
  assert.equal(typingDelay('你好', true, { ...S, typingGroup: false }), 0)
  assert.equal(typingDelay('你好', false, { ...S, charsPerMinute: 0 }), 0)
})

test('群里的发言频率：两条之间至少隔几秒；一分钟最多几条', () => {
  assert.equal(rateDelay([], 100_000, S), 0)
  assert.equal(rateDelay([98_000], 100_000, S), 3_000, '离上一条才 2 秒，再等 3 秒')
  assert.equal(rateDelay([50_000, 70_000, 90_000], 100_000, S), 10_000, '一分钟里已经 3 条，等最早那条出窗口')
  assert.equal(rateDelay([30_000, 70_000, 90_000], 100_000, { ...S, groupMinGapSeconds: 0 }), 0, '最早那条已经出窗口')
})

function fakeClock() {
  let t = 1_000_000
  const waits = []
  return { now: () => t, sleep: async ms => { waits.push(ms); t += ms }, waits, advance: ms => { t += ms } }
}

test('发送前权限撤销：返回 dropped，不占用群发言额度', async () => {
  const c = fakeClock()
  const p = new Pacer({ settings: () => ({ ...S, typingGroup: false }), log: () => {}, now: c.now, sleep: c.sleep })
  assert.equal(await p.run('g', true, '撤销', async () => false), 'dropped')
  assert.equal(await p.run('g', true, '允许', async () => {}), 'sent')
  assert.deepEqual(c.waits, [], '未发出的消息不导致下一条等待群限频')
})

test('排队：同一个群按顺序发，守频率；等太久就不发；私聊不受群频率限制', async () => {
  const c = fakeClock()
  const logs = []
  const p = new Pacer({ settings: () => ({ ...S, typingGroup: false, typingPrivate: false, maxWaitSeconds: 30 }), log: (l, m) => logs.push(m), now: c.now, sleep: c.sleep })
  const out = []
  const send = text => async () => { out.push([text, c.now()]) }
  const results = await Promise.all(['一', '二', '三', '四'].map(x => p.run('snowluma:GroupMessage:1', true, x, send(x))))
  assert.deepEqual(out.map(o => o[0]), ['一', '二', '三'])
  assert.deepEqual(results, ['sent', 'sent', 'sent', 'dropped'], '第四条要等将近一分钟，超过 30 秒就不发')
  assert.equal(out[1][1] - out[0][1], 5_000, '两条之间隔 5 秒')
  assert.ok(logs.some(m => m.includes('太频繁')))
  for (const x of ['a', 'b', 'c', 'd']) assert.equal(await p.run('snowluma:FriendMessage:2', false, x, send(x)), 'sent')
})

test('打字等待和发送顺序：长的先排就先发', async () => {
  const c = fakeClock()
  const p = new Pacer({ settings: () => S, log: () => {}, now: c.now, sleep: c.sleep })
  const out = []
  await Promise.all([p.run('u', false, '这是一句比较长的话', async () => { out.push('长') }), p.run('u', false, '短', async () => { out.push('短') })])
  assert.deepEqual(out, ['长', '短'])
  assert.deepEqual(c.waits, [27_000, 3_000])
})

test('分段：按行拆、去空行、代码块不拆、超过上限并进最后一条；开关按会话类型', async () => {
  const { splitReply, segmentEnabled } = await import('../lib/segment.js')
  assert.deepEqual(splitReply('嗯\n\n  好呀  \n', 10), ['嗯', '好呀'])
  assert.deepEqual(splitReply('看这个\n```js\nconst a = 1\n\nconst b = 2\n```\n懂了吗', 10), ['看这个', '```js\nconst a = 1\n\nconst b = 2\n```', '懂了吗'])
  assert.deepEqual(splitReply('一\n二\n三\n四', 2), ['一', '二\n三\n四'])
  assert.deepEqual(splitReply('只有一句', 1), ['只有一句'])
  const s = { adminPrivate: true, private: false, group: false, maxSegments: 10 }
  assert.equal(segmentEnabled(s, { group: false, adminPrivate: true }), true)
  assert.equal(segmentEnabled(s, { group: false, adminPrivate: false }), false)
  assert.equal(segmentEnabled(s, { group: true, adminPrivate: false }), false)
})

test('分段的打字时间：每段按自己的字数等，每段最多 maxSegmentSeconds 秒，有最短', async () => {
  const { splitTyping } = await import('../lib/pacer.js')
  const s = { ...S, charsPerMinute: 100, typingMinSeconds: 1, typingMaxSeconds: 10 }
  const lines = ['在的', '刚刚在摸鱼呢', '想你了想你了想你了想你了', '嘿']
  assert.deepEqual(splitTyping(lines, false, s, 3), [1_200, 3_000, 3_000, 1_000])
  assert.deepEqual(splitTyping(['a', 'b'], true, { ...s, typingGroup: false }, 3), [0, 0], '关掉打字就不等')
})


test('管理员回复不受群发言限频约束，也不占普通回复额度', async () => {
  const c = fakeClock()
  const p = new Pacer({ settings: () => ({ ...S, typingGroup: false }), log: () => {}, now: c.now, sleep: c.sleep })
  await p.run('g', true, '普通回复', async () => {})
  await p.run('g', true, '管理员回复', async () => {}, undefined, true)
  assert.deepEqual(c.waits, [])
  await p.run('g', true, '下一条普通回复', async () => {})
  assert.deepEqual(c.waits, [5000])
})

test('管理员私聊、其他私聊、群聊的速度/开关/上下限相互独立，群内管理员仍用群配置', async () => {
  const s = { ...S, typingProfiles: {
    adminPrivate: { enabled: true, charsPerMinute: 60, minSeconds: 1, maxSeconds: 30 },
    private: { enabled: true, charsPerMinute: 120, minSeconds: 2, maxSeconds: 8 },
    group: { enabled: true, charsPerMinute: 240, minSeconds: 0, maxSeconds: 3 },
  } }
  assert.equal(typingDelay('abcde', false, s, true), 5000)
  assert.equal(typingDelay('abcde', false, s), 2500)
  assert.equal(typingDelay('abcde', true, s), 1250)
  assert.equal(typingDelay('abcde', true, s, true), 1250)
  assert.equal(typingDelay('a', false, s), 2000)
  assert.equal(typingDelay('a'.repeat(100), false, s), 8000)
  const disabled = { ...s, typingProfiles: { ...s.typingProfiles, adminPrivate: { ...s.typingProfiles.adminPrivate, enabled: false } } }
  assert.equal(typingDelay('abcde', false, disabled, true), 0)
  assert.equal(typingDelay('abcde', false, disabled), 2500)
  const clock = fakeClock(), pacer = new Pacer({ settings: () => s, log: () => {}, now: clock.now, sleep: clock.sleep })
  await pacer.run('owner', false, 'abcde', async () => {}, undefined, true, true)
  await pacer.run('other', false, 'abcde', async () => {})
  await pacer.run('group', true, 'abcde', async () => {}, undefined, true)
  assert.deepEqual(clock.waits, [5000,2500,1250])
  const { splitTyping } = await import('../lib/pacer.js')
  assert.deepEqual(splitTyping(['abcde','a'],false,s,3,true),[3000,1000])
  assert.deepEqual(splitTyping(['abcde','a'],false,s,3),[2500,2000])
  assert.deepEqual(splitTyping(['abcde','a'],true,s,3),[1250,250])
  assert.equal(typingDelay('abcde',false,S,true),typingDelay('abcde',false,S),'legacy configurations retain the original administrator-private pace')
})
