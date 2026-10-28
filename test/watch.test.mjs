// 单元测试：掉线检测（什么时候算掉线、宽限、重复提醒、恢复提醒）和提醒渠道（Server酱地址、推送结果判断）。不联网。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { Watchdog } from '../lib/watch.js'
import { sendPush, serverChanUrl } from '../lib/alert.js'

const MIN = 60_000
function setup(over = {}) {
  let now = 1_000_000
  const sent = []
  let conns = [{ selfId: '42' }]
  let status = { online: true }
  const w = new Watchdog({
    settings: () => ({ enabled: true, intervalMinutes: 2, graceMinutes: 3, repeatHours: 6, alertOnRecover: true, ...over }),
    connections: () => conns,
    callAction: async action => {
      if (status === 'hang') throw new Error('8 秒内没有回应')
      return action === 'get_status' ? status : { user_id: 42, nickname: '小号' }
    },
    alert: async (kind, st) => { sent.push({ kind, state: st.state }); return ['邮件：已发送'] },
    log: () => {},
    now: () => now,
  })
  return { w, sent, tick: ms => { now += ms }, setConns: c => { conns = c }, setStatus: s => { status = s } }
}

test('在线时不提醒；刚启动的头几分钟不提醒', async () => {
  const { w, sent, tick, setConns } = setup()
  assert.equal((await w.check()).state, 'ok')
  setConns([])
  assert.equal((await w.check()).state, 'disconnected')
  assert.equal(sent.length, 0, '刚启动不提醒')
  tick(2 * MIN); await w.check()
  assert.equal(sent.length, 0, '还没过宽限')
  tick(2 * MIN); await w.check()
  assert.deepEqual(sent, [{ kind: 'problem', state: 'disconnected' }])
})

test('SnowLuma 报下线：过了启动宽限就马上提醒；没恢复不重复吵，过了几小时再提醒；恢复发一条', async () => {
  const { w, sent, tick, setStatus } = setup()
  tick(5 * MIN)
  w.onOffline({ notice_type: 'bot_offline', self_id: 42, tag: '被踢下线', message: '账号在别处登录' })
  await new Promise(r => setTimeout(r, 0))
  assert.deepEqual(sent, [{ kind: 'problem', state: 'offline' }])
  assert.match(w.status().reason, /被踢下线：账号在别处登录/)
  setStatus({ online: false })
  tick(10 * MIN); await w.check()
  assert.equal(sent.length, 1, '没到 6 小时不再提醒')
  tick(6 * 60 * MIN); await w.check()
  assert.equal(sent.length, 2, '过了 6 小时再提醒一次')
  setStatus({ online: true })
  await w.check()
  await new Promise(r => setTimeout(r, 0))
  assert.deepEqual(sent.at(-1), { kind: 'recovered', state: 'ok' })
  assert.equal(w.status().account.nickname, '小号')
})

test('心跳报不在线也算掉线；关掉检测就不提醒', async () => {
  const a = setup()
  a.tick(5 * MIN)
  a.w.onHeartbeat({ self_id: 42, status: { online: false } })
  assert.equal(a.w.status().state, 'offline')
  const b = setup({ enabled: false })
  b.tick(5 * MIN); b.setConns([]); await b.w.check(); b.tick(5 * MIN); await b.w.check()
  assert.equal(b.sent.length, 0)
})

test('Server酱地址：新版 sctp 开头走 push.ft07.com，旧版走 sctapi.ftqq.com；推送结果按各家的成功码判断', async () => {
  assert.equal(serverChanUrl('sctp1234tABC'), 'https://1234.push.ft07.com/send/sctp1234tABC.send')
  assert.equal(serverChanUrl('SCT999abc'), 'https://sctapi.ftqq.com/SCT999abc.send')
  const reply = body => async () => new Response(JSON.stringify(body), { status: 200 })
  await sendPush({ service: 'serverchan', key: 'SCTx' }, { title: 't', text: 'x' }, reply({ code: 0 }))
  await sendPush({ service: 'pushplus', key: 'tok' }, { title: 't', text: 'x' }, reply({ code: 200 }))
  await assert.rejects(sendPush({ service: 'pushplus', key: 'tok' }, { title: 't', text: 'x' }, reply({ code: 903, msg: '无效的用户token' })), /无效的用户token/)
  await assert.rejects(sendPush({ service: 'serverchan', key: '' }, { title: 't', text: 'x' }), /还没填 Key/)
})

test('get_status 没有明确 online=true 时不能误报恢复在线', async () => {
  const t = setup()
  t.tick(5 * MIN)
  t.w.onOffline({ self_id: 42, message: '下线' })
  await new Promise(r => setTimeout(r, 0))
  for (const status of [null, {}, { good: true }]) {
    t.setStatus(status)
    assert.equal((await t.w.check()).state, 'unknown')
    assert.ok(!t.sent.some(x => x.kind === 'recovered'))
  }
  t.setStatus({ online: true })
  await t.w.check()
  assert.equal(t.sent.at(-1).kind, 'recovered')
})
