// 单元测试：文字转语音（哪段用语音、念之前收拾文字、每条先 Breeze、不行这条换 Inworld）。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { Tts, planPieces, speakableText, testSpeak } from '../lib/tts.js'

const S = { enabled: true, mode: 'tag', chance: 30, adminPrivate: true, private: false, group: false, maxChars: 50, alsoText: false, stripParens: true, speed: 100, timezone: 'Asia/Shanghai', breeze: { key: 'bk', voiceId: 'bv', model: 'breeze-tts-2', language: 'zh' }, inworld: { key: 'iw', voiceId: 'iv', model: 'inworld-tts-2-flash' } }
const MP3 = Buffer.alloc(200, 1)

/** 假接口：按地址决定 Breeze / Inworld 怎么回，记下每次请求 */
function fakeFetch(plan) {
  const calls = []
  const fn = async (url, init) => {
    const who = String(url).includes('breeze') ? 'breeze' : 'inworld'
    calls.push({ who, url: String(url), headers: init.headers, body: JSON.parse(init.body) })
    const r = plan[who]()
    if (r === 'net') throw new TypeError('fetch failed')
    if (typeof r === 'number') return new Response(JSON.stringify({ error: { code: r === 402 ? 'BILLING_INSUFFICIENT_CREDITS' : 'X' } }), { status: r, headers: { 'content-type': 'application/json' } })
    return who === 'breeze' ? new Response(MP3, { headers: { 'content-type': 'audio/mpeg' } }) : Response.json({ audioContent: MP3.toString('base64') })
  }
  return { fn, calls }
}

test('哪段用语音：tag 模式只念 [语音] 开头的行；太长、只有动作的不念；没开时去掉记号', () => {
  assert.deepEqual(planPieces(['好呀\n[语音] 想你了\n【语音】（摸头）\n你呢'], S, true), [
    { text: '好呀', voice: false }, { text: '想你了', voice: true }, { text: '（摸头）', voice: false }, { text: '你呢', voice: false }])
  assert.deepEqual(planPieces(['[语音]' + '长'.repeat(60)], S, true), [{ text: '长'.repeat(60), voice: false }])
  assert.deepEqual(planPieces(['[语音]你好', '  缩进的代码'], S, false), [{ text: '你好', voice: false }, { text: '缩进的代码', voice: false }])
  assert.deepEqual(planPieces(['一', '二'], { ...S, mode: 'always' }, true).map(p => p.voice), [true, true])
  assert.deepEqual(planPieces(['一'], { ...S, mode: 'chance', chance: 30 }, true, () => 0.5).map(p => p.voice), [false])
  assert.deepEqual(planPieces(['一'], { ...S, mode: 'chance', chance: 30 }, true, () => 0.1).map(p => p.voice), [true])
})

test('念之前收拾文字：去掉括号动作、星号、Markdown', () => {
  assert.equal(speakableText('[语音]**好呀**（笑）*歪头* 今天(真的)很开心', true), '好呀 今天很开心')
  assert.equal(speakableText('今天(真的)很开心', false), '今天(真的)很开心')
})

test('Breeze 正常就用 Breeze，请求格式对', async () => {
  const f = fakeFetch({ breeze: () => 'ok', inworld: () => 'ok' })
  const tts = new Tts({ settings: () => S, log: () => {}, fetch: f.fn })
  const r = await tts.speak('你好')
  assert.equal(r.provider, 'breeze')
  assert.equal(f.calls.length, 1)
  assert.match(f.calls[0].url, /\/v1\/text-to-speech\/bv\?output_format=mp3$/)
  assert.equal(f.calls[0].headers['xi-api-key'], 'bk')
  assert.deepEqual(f.calls[0].body, { text: '你好', model_id: 'breeze-tts-2', language_code: 'zh' })
  assert.equal(tts.status().today.breeze, 1)
})

test('每一条都先试 Breeze：这条额度用完或连不上就这条用 Inworld，下一条照样先试 Breeze', async () => {
  let breeze = 402
  const f = fakeFetch({ breeze: () => breeze, inworld: () => 'ok' })
  const tts = new Tts({ settings: () => S, log: () => {}, fetch: f.fn })
  assert.equal((await tts.speak('一')).provider, 'inworld')
  assert.equal(f.calls[1].headers.authorization, 'Basic iw')
  assert.deepEqual(f.calls[1].body, { text: '一', voiceId: 'iv', modelId: 'inworld-tts-2-flash', audioConfig: { audioEncoding: 'MP3' } })
  assert.match(tts.status().lastFallback.text, /额度用完/)
  breeze = 'net'
  for (const x of ['二', '三', '四', '五']) assert.equal((await tts.speak(x)).provider, 'inworld')
  assert.equal(f.calls.filter(c => c.who === 'breeze').length, 5, '每条都问过 Breeze')
  breeze = 'ok'
  assert.equal((await tts.speak('六')).provider, 'breeze', 'Breeze 好了马上用回它')
  assert.deepEqual([tts.status().today.breeze, tts.status().today.inworld], [1, 5])
})

test('两家都不行就报错（调用方改发文字）', async () => {
  const f = fakeFetch({ breeze: () => 'net', inworld: () => 500 })
  const tts = new Tts({ settings: () => S, log: () => {}, fetch: f.fn })
  await assert.rejects(tts.speak('z'), /连不上.*Inworld 返回 HTTP 500/)
  assert.equal(tts.status().today.failed, 1)
})

test('只填了 Inworld 就直接用 Inworld；Key 带了 "Basic " 也认', async () => {
  const f = fakeFetch({ breeze: () => 'ok', inworld: () => 'ok' })
  const s = { ...S, breeze: { ...S.breeze, key: '' }, inworld: { ...S.inworld, key: 'Basic abc' } }
  const tts = new Tts({ settings: () => s, log: () => {}, fetch: f.fn })
  assert.equal((await tts.speak('你好')).provider, 'inworld')
  assert.equal(f.calls[0].headers.authorization, 'Basic abc')
})

test('试听：只用指定那一家，返回 base64；音色不对时提示', async () => {
  const ok = await testSpeak(S, 'inworld', '', fakeFetch({ breeze: () => 'ok', inworld: () => 'ok' }).fn)
  assert.equal(ok.ok, true)
  assert.equal(Buffer.from(ok.audio, 'base64').length, 200)
  const bad = await testSpeak(S, 'breeze', '你好', fakeFetch({ breeze: () => 404, inworld: () => 'ok' }).fn)
  assert.equal(bad.ok, false)
  assert.match(bad.error, /找不到这个音色/)
})
