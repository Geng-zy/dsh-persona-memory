// 单元测试：直接用自己的 Key 调别家模型（假的接口，不联网）、各家思考等级参数的写法。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { chatComplete, effortsOf, thinkParams, thinkStyleOf } from '../../lib/companion/chat.js'

test('按接口地址认出思考开关的写法，翻成各家的参数', () => {
  assert.equal(thinkStyleOf('https://api.openai.com/v1'), 'effort')
  assert.equal(thinkStyleOf('https://dashscope.aliyuncs.com/compatible-mode/v1'), 'budget')
  assert.equal(thinkStyleOf('https://api.siliconflow.cn/v1'), 'budget')
  assert.equal(thinkStyleOf('https://open.bigmodel.cn/api/paas/v4'), 'toggle')
  assert.equal(thinkStyleOf('https://ark.cn-beijing.volces.com/api/v3'), 'toggle')
  assert.equal(thinkStyleOf('https://openrouter.ai/api/v1'), 'openrouter')
  assert.equal(thinkStyleOf('https://api.moonshot.cn/v1'), 'none')
  assert.deepEqual(thinkParams('effort', 'low'), { reasoning_effort: 'low' })
  assert.deepEqual(thinkParams('effort', 'off'), {})
  assert.deepEqual(thinkParams('budget', 'off'), { enable_thinking: false })
  assert.deepEqual(thinkParams('budget', 'low'), { enable_thinking: true, thinking_budget: 1024 })
  assert.deepEqual(thinkParams('toggle', 'low'), { thinking: { type: 'enabled' } })
  assert.deepEqual(thinkParams('toggle', 'off'), { thinking: { type: 'disabled' } })
  assert.deepEqual(thinkParams('openrouter', 'high'), { reasoning: { effort: 'high' } })
  assert.deepEqual(thinkParams('none', 'high'), {})
  assert.deepEqual(effortsOf('toggle'), ['off', 'low'])
  assert.deepEqual(effortsOf('none'), [])
})

test('直接调别家：请求格式、拿回文字、出错说清楚', async () => {
  let seen
  const ok = async (url, init) => { seen = { url, init, body: JSON.parse(init.body) }; return new Response(JSON.stringify({ choices: [{ message: { content: '好' } }] }), { status: 200 }) }
  const text = await chatComplete({ url: 'https://api.siliconflow.cn/v1/', key: 'sk-1', model: 'm', effort: 'low' }, '你好', 100, undefined, ok)
  assert.equal(text, '好')
  assert.equal(seen.url, 'https://api.siliconflow.cn/v1/chat/completions')
  assert.equal(seen.init.headers.authorization, 'Bearer sk-1')
  assert.deepEqual(seen.body, { model: 'm', messages: [{ role: 'user', content: '你好' }], max_tokens: 100, stream: false, enable_thinking: true, thinking_budget: 1024 })
  await assert.rejects(chatComplete({ url: 'https://x/v1', key: 'k', model: 'm' }, 'q', 10, undefined, async () => new Response('bad key', { status: 401 })), /HTTP 401/)
  await assert.rejects(chatComplete({ url: 'https://x/v1', key: 'k', model: 'm' }, 'q', 10, undefined, async () => new Response(JSON.stringify({ choices: [{ message: { content: '' }, finish_reason: 'length' }] }), { status: 200 })), /思考等级调低/)
})
