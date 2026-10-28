import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import WebSocket from 'ws'
import { CQHttp } from '../lib/onebot/server.js'

test('API 连接断开只拒绝其等待请求，其他账号仍可响应；停止适配器不留下悬挂调用', async t => {
  const bot = new CQHttp({ log: () => {}, apiTimeoutSec: 60 })
  await bot.run('127.0.0.1', 0)
  t.after(() => bot.close())
  const connect = async id => {
    const ws = new WebSocket('ws://127.0.0.1:' + bot.http.address().port + '/ws', { headers: { 'X-Client-Role': 'Universal', 'X-Self-ID': id } })
    await once(ws, 'open')
    t.after(() => ws.terminate())
    return ws
  }
  const a = await connect('1'), b = await connect('2')
  const frameA = once(a, 'message'), frameB = once(b, 'message')
  const rejectedA = assert.rejects(bot.callAction('get_status', { self_id: '1' }), /connection closed/)
  const resultB = bot.callAction('get_status', { self_id: '2' })
  await frameA
  const [rawB] = await frameB
  a.close()
  await rejectedA
  b.send(JSON.stringify({ status: 'ok', data: { online: true }, echo: JSON.parse(rawB.toString()).echo }))
  assert.deepEqual(await resultB, { online: true })
  const frame = once(b, 'message')
  const rejected = assert.rejects(bot.callAction('get_login_info', { self_id: '2' }), /adapter closed/)
  await frame
  await bot.close()
  await rejected
})
