import { test } from 'node:test'
import assert from 'node:assert/strict'
import { judgePrompt, parseJudge, judgeResponse } from '../lib/judge.js'
test('判断只接受明确布尔结果，正文与目标身份都有传入', () => {
  assert.equal(parseJudge('{"addressed":false,"reply":false}'), false)
  assert.equal(parseJudge('```json\n{"addressed":true,"reply":true}\n```'), true)
  for (const value of ['[不发]', '{}', '{"addressed":true,"reply":"false"}']) assert.throws(() => parseJudge(value))
  const prompt = judgePrompt({ message: { self_id: '100', sender: { user_id: '200' }, message: [{ type: 'At', qq: '300' }] }, content: [{ type: 'text', text: '正文' }], context: ['历史'] })
  for (const value of ['100', '200', '300', '正文', '历史']) assert.ok(prompt.includes(value))
})
test('判断请求无工具、无会话且携带取消信号', async () => {
  let options
  await assert.rejects(judgeResponse({ stream: async function* (o) { options = o; throw new Error('测试失败') } }, { provider: 'p', model: 'm' }, { message: { sender: {}, message: [] }, content: [], context: [] }, new AbortController().signal))
  assert.equal(options.tools, undefined)
  assert.equal(options.sessionId, undefined)
  assert.equal(options.messages.length, 1)
  assert.ok(options.signal)
})
