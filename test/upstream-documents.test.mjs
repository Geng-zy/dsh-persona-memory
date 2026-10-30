import test from 'node:test'
import assert from 'node:assert/strict'
import { officialDocument, normalizeDocument, readableDocument, publicRedirectAllowed, upstreamRequestError } from '../lib/upstream-documents.js'
const text = '官方接口发布记录，包含模型版本、调用参数及正式兼容说明。'.repeat(8)
test('忽略noscript提示而保留真实正文，不把SPA空壳算成功', async () => {
 const document = '<noscript>You need to enable JavaScript to run this app.</noscript><article>'+text+'</article>'
 const r = await officialDocument('https://docs.volcengine.com/docs/ark',async()=>({text:document}))
 assert.equal(r.text,text); assert.equal(readableDocument(normalizeDocument('<title>模型</title><noscript>enable javascript to run</noscript><div id="root"></div>')),false)
 assert.equal(readableDocument('Checking your browser. '+text),false)
})
test('真实article优先于导航与页面外提示，稳定正文摘要', () => {
 assert.equal(normalizeDocument('<div>changing banner</div><article>'+text+'</article><footer>today</footer>'),text)
})
test('魔搭从官方目录动态读取Markdown，不硬编码日期、不用Jina', async () => {
 const seen=[]; const prefix='https://resouces.modelscope.cn/document/docdata/2026-10-30_00-01-CN'
 const r=await officialDocument('https://modelscope.cn/docs/model-service/API-Inference/intro',async url=>{seen.push(url);return url.includes('/api/')?{json:{Success:true,Data:{TargetPrefix:prefix}}}:{text:'# API推理\n'+text}})
 assert.equal(seen.length,2); assert.equal(seen[1],prefix+'/dist/model-service/API-Inference/intro/intro_CN.md');assert.match(r.text,/API推理/);assert.match(r.method,/官方公开/)
})
test('魔搭文档目录不信任任意主机、凭证或路径，HTML外壳不当Markdown', async () => {
 for(const prefix of ['https://evil.example/document/docdata/valid','http://resouces.modelscope.cn/document/docdata/valid','https://user:pass@resouces.modelscope.cn/document/docdata/valid','https://resouces.modelscope.cn/document/docdata/valid?token=secret','https://resouces.modelscope.cn/document/docdata/../private']) {
  let calls=0; await assert.rejects(officialDocument('https://www.modelscope.cn/docs/model-service/API-Inference/intro',async()=>{calls++;return{json:{Success:true,Data:{TargetPrefix:prefix}}}}),/目录无效/);assert.equal(calls,1)
 }
 await assert.rejects(officialDocument('https://modelscope.cn/docs/model-service/API-Inference/intro',async url=>url.includes('/api/')?{json:{Success:true,Data:{TargetPrefix:'https://resouces.modelscope.cn/document/docdata/release'}}}:{text:'<!DOCTYPE html><html>'+text+'</html>'}),/网页外壳/)
})
test('仅允许同站或明确登记的官方迁移，不扩大到任意跨域/同公共后缀', () => {
 const ok=(a,b)=>publicRedirectAllowed(new URL(a),new URL(b))
 assert.ok(ok('https://platform.moonshot.cn/docs/introduction','https://platform.kimi.com/docs/introduction'))
 assert.ok(ok('https://platform.minimaxi.com/docs/x','https://platform.minimax.cn/docs/x'))
 assert.ok(ok('https://www.volcengine.com/docs/x','https://docs.volcengine.com/docs/x'))
 assert.ok(!ok('https://evil.com.cn/x','https://other.com.cn/x'))
 for(const target of ['http://platform.kimi.com/docs/x','https://platform.kimi.com:8080/docs/x','https://user:pass@platform.kimi.com/docs/x','https://platform.kimi.com.evil.example/docs/x','https://platform.kimi.com/account'])assert.ok(!ok('https://platform.moonshot.cn/docs/x',target))
})
test('请求诊断保留超时、DNS、TLS和取消，避免只剩fetch failed', () => {
 assert.match(upstreamRequestError({message:'fetch failed',cause:{code:'ENOTFOUND'}}),/ENOTFOUND/)
 assert.match(upstreamRequestError({message:'fetch failed',cause:{code:'CERT_HAS_EXPIRED'}}),/CERT_HAS_EXPIRED/)
 assert.match(upstreamRequestError({message:'fetch failed',cause:{code:'UND_ERR_CONNECT_TIMEOUT'}}),/超时/)
 assert.match(upstreamRequestError({name:'AbortError'}),/取消/)
})
