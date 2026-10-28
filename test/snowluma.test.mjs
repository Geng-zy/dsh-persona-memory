import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadImage } from '../lib/images.js'
import { transcribe, silentWav } from '../lib/stt.js'
import { AiocqhttpMessageEvent } from '../lib/adapter.js'
import { make, toDictAsync } from '../lib/components.js'

const png = Buffer.from('89504e470d0a1a0a00000000', 'hex')
async function withServer(fn) {
  const server = createServer(async (req,res) => {
    if (req.url === '/image') return res.end(png)
    if (req.url === '/voice') return res.end(silentWav(10))
    if (req.url === '/audio/transcriptions') {
      const chunks=[]; for await (const c of req) chunks.push(c)
      assert.ok(Buffer.concat(chunks).includes(Buffer.from('RIFF')))
      res.setHeader('content-type','application/json'); return res.end(JSON.stringify({ text:'听清了' }))
    }
    res.writeHead(404).end()
  })
  await new Promise(r => server.listen(0,'127.0.0.1',r))
  try { await fn('http://127.0.0.1:'+server.address().port) } finally { await new Promise(r => server.close(r)) }
}
test('SnowLuma get_image 的 file 为 HTTP URL，容器路径不可见时仍可通过 URL 获取', async () => {
  await withServer(async base => {
    for (const data of [{file:base+'/image'}, {file:'/app/data/inaccessible.png',url:base+'/image'}]) {
      const image=await loadImage(make('Image',{file:'image-cache-id'}),async action => { assert.equal(action,'get_image');return data })
      assert.equal(image.data,png.toString('base64'))
    }
  })
})
test('SnowLuma/SnowLuma 语音的 URL、转换结果 base64 均能送入转写，容器路径失败后尝试 URL', async () => {
  await withServer(async base => {
    for (const data of [{file:base+'/voice'}, {file:'/app/data/no-voice.wav',url:base+'/voice'}, {base64:Buffer.from(silentWav(10)).toString('base64')}]) {
      const text=await transcribe(make('Record',{file:'voice-cache-id'}),{mode:'openai',apiUrl:base,apiKey:'',model:'fake'},async action => {assert.equal(action,'get_record');return data})
      assert.equal(text,'听清了')
    }
  })
})
test('跨容器发送文件和视频使用内容，保留外部 URL；转发节点中的本地文件/视频同样有效', async () => {
  const dir=mkdtempSync(join(tmpdir(),'snowluma-send-'))
  try {
    const path=join(dir,'file.txt');writeFileSync(path,'hello')
    const encoded='base64://'+Buffer.from('hello').toString('base64')
    const file=make('File',{name:'file.txt',file_:path})
    const video=make('Video',{file:pathToFileURL(path).href})
    assert.equal((await AiocqhttpMessageEvent.fromSegmentToDict(file)).data.file,encoded)
    assert.equal((await AiocqhttpMessageEvent.fromSegmentToDict(video)).data.file,encoded)
    assert.equal((await toDictAsync(make('Video',{file:'https://example.invalid/v.mp4'}))).data.file,'https://example.invalid/v.mp4')
    const node=await toDictAsync(make('Node',{uin:'42',name:'x',content:[file,video]}))
    assert.ok(node.data.content.every(c=>c.data.file===encoded))
  } finally {rmSync(dir,{recursive:true,force:true})}
})
