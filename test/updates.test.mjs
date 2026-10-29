import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {UpdateMonitor,chooseNpmVersion,extraSources,redact,normalizeDocument,updateSchema} from '../lib/updates.js'
import {updateCatalog} from '../lib/update-catalog.js'
const settings=()=>({updatesEnabled:true,updatesIntervalDays:7,updatesAutoAnalyze:true,updatesModelProvider:'',updatesModel:'',updatesMaxTokens:1024,updatesMaxModelCalls:2,updatesModelTimeoutSeconds:10,updatesGithubToken:'',updatesMailEnabled:true,updatesSmtpHost:'smtp.example.org',updatesSmtpPort:465,updatesSmtpUser:'person@example.org',updatesSmtpPass:'private-password-for-tests',updatesMailTo:'recipient@example.org',updatesPushService:'pushplus',updatesPushKey:'private-token-for-tests',updatesExtraSources:'[]'})
const source=(kind='npm',extra={})=>({id:'a',name:'example-package',kind,target:kind==='github'?'owner/project':'example-package',current:'1.0.0',purpose:'fixture',category:'test',...extra})
function harness(t,sources=[source()],more={}){
 const directory=mkdtempSync(join(tmpdir(),'upstream-test-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));const config=settings(),sent=[],requests=[];let now=1_800_000_000_000;
 const cat={owner:'fixture-plugin',version:'1.0.0',repository:'https://github.com/example/public',lockHash:'abc',sources,limitations:['fixture limitation']};
 const fetch=async(url,opts)=>{requests.push([String(url),opts]);if(String(url).includes('osv.dev'))return Response.json({results:JSON.parse(opts.body).queries.map(()=>({vulns:[]}))});if(String(url).includes('/example-package/'))return Response.json({});return Response.json({versions:{'1.0.0':{},'1.1.0':{},'2.0.0-beta.1':{}}})};
 const deps={catalog:cat,directory,settings:()=>config,now:()=>now,fetch,notify:async(channel,title,text)=>sent.push({channel,title,text}),...more};const monitor=new UpdateMonitor(deps);return{monitor,config,sent,requests,directory,deps,setNow:n=>now=n};
}
test('默认关闭；两个插件清单包含锁定间接依赖、宿主接口和公开来源，不包含本机信息',()=>{
 assert.equal(updateSchema.updatesEnabled.meta.default,false);assert.equal(updateSchema.updatesIntervalDays.meta.default,7)
 assert.ok(updateCatalog.sources.some(x=>x.category==='transitive-package'));assert.ok(updateCatalog.sources.some(x=>x.kind==='npm'&&x.prerelease));assert.ok(updateCatalog.sources.some(x=>x.category==='service'))
 assert.ok(updateCatalog.sources.every(x=>x.id&&x.purpose&&x.target));assert.doesNotMatch(JSON.stringify(updateCatalog),/\/Users\/|\/home\/|62\.234\./)
})
test('关闭功能不检查、不调用模型、不通知，即使手动请求也拒绝',async t=>{const h=harness(t);h.config.updatesEnabled=false;await h.monitor.tick();await assert.rejects(h.monitor.check(),/启用/);await assert.rejects(h.monitor.analyze(),/启用/);await h.monitor.notify();assert.equal(h.requests.length,0);assert.equal(h.sent.length,0)})
test('正式版按semver排序；仅dsh规则允许预览版，dist-tag不能冒充稳定版',()=>{const d={versions:{'1.9.9':{},'1.10.0':{},'2.0.0-rc.2':{},'2.0.0-rc.10':{},'junk':{}},'dist-tags':{latest:'2.0.0-rc.10'}};assert.equal(chooseNpmVersion(d,false),'1.10.0');assert.equal(chooseNpmVersion(d,true),'2.0.0-rc.10')})
test('首次检查发现npm新版，分别通知两个渠道，模型缺失仍有完整基础文档；重启去重且每周运行',async t=>{
 const h=harness(t);await h.monitor.tick();assert.equal(h.monitor.snapshot().results[0].latest,'1.1.0');assert.deepEqual(h.sent.map(x=>x.channel),['mail','push']);assert.match(h.monitor.snapshot().report.markdown,/完整依赖清单/);assert.match(h.monitor.snapshot().report.errors[0],/未配置/)
 const before=h.requests.length;await h.monitor.tick();assert.equal(h.requests.length,before)
 const resumed=new UpdateMonitor(h.deps);await resumed.check();assert.equal(h.sent.length,2)
 h.setNow(1_800_000_000_000+8*86_400_000);await resumed.tick();assert.ok(h.requests.length>before);assert.equal(h.sent.length,2)
})
test('两个插件使用独立目录、基准和通知，不共享送达状态',async t=>{const a=harness(t),b=harness(t);await a.monitor.check();assert.equal(b.sent.length,0);await b.monitor.check();assert.equal(a.sent.length,2);assert.equal(b.sent.length,2)})
test('失败通知按渠道保留重试；资料下一次不变也不会丢失待发事项',async t=>{
 let fail=true,body='<main>Official stable release content '.repeat(10)+'</main>'
 const delivered=[];const h=harness(t,[source('document',{target:'https://example.org/releases',current:undefined})],{fetch:async()=>new Response(body),notify:async(c)=>{if(c==='mail'&&fail)throw Error('private remote error');delivered.push(c)}})
 await h.monitor.check();assert.equal(delivered.length,0);body+='new stable release';await h.monitor.check();assert.deepEqual(delivered,['push']);assert.ok(h.monitor.snapshot().retryAt)
 await h.monitor.check();fail=false;await h.monitor.notify();assert.deepEqual(delivered,['push','mail']);assert.equal(h.monitor.snapshot().retryAt,undefined)
})
test('上游错误保留错误状态并通知；不视为最新，失败后有补查时间',async t=>{const h=harness(t,[source()],{fetch:async()=>new Response('',{status:429})});await h.monitor.check();const d=h.monitor.snapshot();assert.equal(d.results[0].status,'error');assert.ok(d.lastError);assert.ok(d.retryCheckAt);assert.equal(h.sent.length,2);assert.doesNotMatch(JSON.stringify(d),/private-password-for-tests|private-token-for-tests/)})
test('GitHub只取非草稿正式发行，忽略预览，收集区间发布说明',async t=>{const h=harness(t);h.deps.fetch=async()=>Response.json([]);const monitor=new UpdateMonitor({...h.deps,fetch:async()=>Response.json([{tag_name:'v9.0.0',draft:true},{tag_name:'v3.0.0-rc.1',prerelease:true},{tag_name:'v2.0.0',draft:false,prerelease:false,body:'Breaking API change',published_at:'2030-01-02',html_url:'https://github.com/owner/project/releases/tag/v2.0.0'},{tag_name:'v1.0.0',draft:false,prerelease:false}])});const r=await monitor.inspect(source('github'));assert.equal(r.latest,'v2.0.0');assert.equal(r.status,'update');assert.match(r.notes,/Breaking API change/);assert.deepEqual(r.versions,['v2.0.0'])})
test('GitHub无发行不能误报最新；预览通道明确可比较rc',async t=>{const h=harness(t);const empty=new UpdateMonitor({...h.deps,fetch:async()=>Response.json([])});assert.equal((await empty.inspect(source('github'))).status,'error');const preview=new UpdateMonitor({...h.deps,fetch:async()=>Response.json([{tag_name:'v2.0.0-rc.1',draft:false,prerelease:true}])});assert.equal((await preview.inspect(source('github',{prerelease:true}))).latest,'v2.0.0-rc.1')})
test('资源文件跟踪提交；未提供基准时首次建档，下次发生变化可识别',async t=>{let sha='a'.repeat(40);const h=harness(t,[source('github-file',{target:'owner/project',current:undefined,path:'data.json'})],{fetch:async()=>Response.json([{sha,commit:{message:'resource change'}}])});await h.monitor.check();assert.equal(h.monitor.snapshot().results[0].status,'baseline');await h.monitor.check();assert.equal(h.monitor.snapshot().results[0].status,'current');sha='b'.repeat(40);await h.monitor.check();assert.equal(h.monitor.snapshot().results[0].status,'changed');assert.equal(h.sent.length,2)})
test('PyPI排除预览和撤回版本',async t=>{const h=harness(t,[],{fetch:async()=>Response.json({releases:{'1.0.0':[{}],'1.1.0':[{}],'2.0.0':[{yanked:true}],'3.0.0-rc.1':[{}]}})});const r=await h.monitor.inspect(source('pypi'));assert.equal(r.latest,'1.1.0');assert.equal(r.status,'update')})
test('Node只比较上游LTS，FFmpeg只识别正式源码发行',async t=>{const h=harness(t,[],{fetch:async url=>String(url).includes('nodejs')?Response.json([{version:'v30.0.0',lts:false},{version:'v28.1.0',lts:'Future'},{version:'v28.2.0-rc.1',lts:'Future'}]):new Response('<a href="ffmpeg-9.0.2.tar.xz">stable</a>')});assert.equal((await h.monitor.inspect(source('node-lts',{target:'https://nodejs.org/dist/index.json'}))).latest,'v28.1.0');assert.equal((await h.monitor.inspect(source('ffmpeg-release',{target:'https://ffmpeg.org/download.html'}))).latest,'9.0.2')})
test('补充项仅接受公开包/仓库标识，不执行命令或请求用户给出的URL',()=>{assert.equal(extraSources('[{"kind":"github","target":"owner/repo","current":"v1.0.0"}]').length,1);assert.throws(()=>extraSources('[{"kind":"command","target":"rm -rf /","current":"1"}]'));assert.throws(()=>extraSources('[{"kind":"npm","target":"https://private/?token=secret","current":"1"}]'));assert.throws(()=>extraSources('{}'))})
test('隐私过滤覆盖输入输出、邮箱、主机、目录、令牌及URL参数',()=>{const s=redact('QQ: 123456789 a@example.org http://192.168.1.1/private?token=secret /home/example/private '+ 'sk-' + 'a'.repeat(24) + ' private-password-for-tests',['private-password-for-tests']);assert.doesNotMatch(s,/123456789|a@example|192\.168|\/home\/example|abcdefghijkl|private-password|token=secret/);assert.match(s,/REDACTED/)})
test('报告模型只收到公开白名单；没有会话人格配置，输出再次过滤且调用次数有限',async t=>{
 const prompts=[];const llm={async *stream(o){prompts.push(o);yield {type:'block-start',index:0,blockType:'text'};yield {type:'text-delta',index:0,text:'AI分析 contact person@example.org /home/example/private'};yield {type:'block-end',index:0,block:{type:'text',text:'AI分析 contact person@example.org /home/example/private'}};yield {type:'finish',reason:{kind:'stop'}}}};
 const sources=Array.from({length:11},(_,i)=>source('npm',{id:'p'+i}));const h=harness(t,sources,{llm:()=>llm});h.config.updatesModelProvider='fixture';h.config.updatesModel='model';await h.monitor.check();assert.equal(prompts.length,2);assert.equal(h.monitor.snapshot().report.pending,1)
 assert.doesNotMatch(JSON.stringify(prompts),/private-password-for-tests|recipient@example.org|private-token-for-tests|smtp.example.org/);assert.doesNotMatch(h.monitor.snapshot().report.markdown,/person@example.org|\/home\/example/)
 assert.ok(prompts.every(p=>p.tools===undefined&&p.maxTokens===1024&&p.signal))
})
test('模型截断/失败不伪装成功，不阻止基础通知和报告',async t=>{const h=harness(t,[source()],{llm:()=>({async *stream(){yield {type:'finish',reason:{kind:'max-tokens'}}}})});h.config.updatesModelProvider='fixture';h.config.updatesModel='model';await h.monitor.check();assert.equal(h.sent.length,2);assert.equal(h.monitor.snapshot().report.analyzed,0);assert.equal(h.monitor.snapshot().report.pending,1);assert.match(h.monitor.snapshot().report.errors[0],/失败、超时或截断/)})
test('OSV已知漏洞与版本更新分开记录，不会改动基准或静默自动升级',async t=>{const h=harness(t,[source()],{fetch:async(url,opts)=>String(url).includes('osv.dev')?Response.json({results:JSON.parse(opts.body).queries.map(()=>({vulns:[{id:'GHSA-fixture'}]}))}):Response.json({versions:{'1.0.0':{}}})});await h.monitor.check();const r=h.monitor.snapshot().results[0];assert.equal(r.status,'changed');assert.deepEqual(r.advisories,['GHSA-fixture']);assert.equal(r.current,'1.0.0');assert.equal(r.latest,'1.0.0')})
test('忽略仅影响提醒，不改依赖/适配基准，证据和报告继续保留',async t=>{const h=harness(t);h.config.updatesMailEnabled=false;h.config.updatesPushService='off';await h.monitor.check();h.monitor.ignore(h.monitor.snapshot().pending.map(r=>r.fingerprint));h.config.updatesMailEnabled=true;await h.monitor.notify();assert.equal(h.sent.length,0);assert.equal(h.monitor.snapshot().results[0].current,'1.0.0');assert.match(readFileSync(join(h.directory,'upstream-updates.json'),'utf8'),/1.1.0/)})
test('正文去掉脚本、样式和导航；正文不足不能误报最新',async t=>{assert.equal(normalizeDocument('<nav>noise</nav><main>release</main><script>token</script>'),'release');const h=harness(t,[],{fetch:async()=>new Response('<html>Login</html>')});assert.equal((await h.monitor.inspect(source('document',{target:'https://example.org'}))).status,'error')})
test('动态文档后备只提交公开URL，不携带GitHub/通知认证，正文有来源标记',async t=>{
 const requests=[];const h=harness(t,[source('document',{id:'public-doc',target:'https://docs.example.org/changelog',current:undefined})],{fetch:async(url,opts)=>{requests.push([String(url),opts]);return String(url).startsWith('https://r.jina.ai/')?new Response('Title: Official changelog\nURL Source: https://docs.example.org/changelog\nMarkdown Content: Stable 1.2 release documentation '.repeat(5)):new Response('You need to enable JavaScript to run this app.')}})
 h.config.updatesReaderFallback=true;h.config.updatesGithubToken='private-github-token';await h.monitor.check();assert.equal(h.monitor.snapshot().results[0].status,'baseline');assert.ok(requests.some(x=>x[0]==='https://r.jina.ai/https://docs.example.org/changelog'));assert.ok(requests.every(x=>!x[1].headers.authorization));assert.doesNotMatch(JSON.stringify(requests),/private-github-token|private-password-for-tests/)
})
test('官方文档HTTPS站内跳转可跟随；跨站跳转不转发令牌',async t=>{
 const requests=[];const h=harness(t,[],{fetch:async(url,opts)=>{requests.push([String(url),opts]);return requests.length===1?new Response('',{status:308,headers:{location:'https://docs.example.org/new'}}):new Response('Official documentation about this public API and its stable versions. '.repeat(4))}});const r=await h.monitor.inspect(source('document',{target:'https://example.org/old'}));assert.equal(r.status,'baseline');assert.equal(requests.length,2)
 const denied=new UpdateMonitor({...h.deps,fetch:async()=>new Response('',{status:302,headers:{location:'https://different.example.net/'}})});assert.equal((await denied.inspect(source('document',{target:'https://example.org/old'}))).status,'error')
})
test('并发检查拒绝重复工作；并发通知按同一任务去重',async t=>{
 const h=harness(t);const task=h.monitor.check();await assert.rejects(h.monitor.check(),/正在运行/);await task;await Promise.all([h.monitor.notify(),h.monitor.notify()]);assert.equal(h.sent.length,2)
})
test('同一组更新重复检查保留已有AI文档，不重复调用模型；PyPI支持短版本和post正式版',async t=>{
 let calls=0;const h=harness(t,[source()],{llm:()=>({async *stream(){calls++;yield {type:'block-end',index:0,block:{type:'text',text:'已核对的公开变化分析'}};yield {type:'finish',reason:{kind:'stop'}}}})});h.config.updatesModelProvider='fixture';h.config.updatesModel='model';await h.monitor.check();const report=h.monitor.snapshot().report;await h.monitor.check();assert.equal(calls,1);assert.equal(h.monitor.snapshot().report.markdown,report.markdown)
 const p=new UpdateMonitor({...h.deps,fetch:async()=>Response.json({releases:{'1.1':[{}],'1.1.post1':[{}],'1.2rc1':[{}]}})});assert.equal((await p.inspect(source('pypi',{current:'1.1'}))).latest,'1.1.post1')
})
test('独立报告API支持OpenAI及Anthropic，不携带dsh模型或业务上下文',async()=>{
 const {reportApiComplete,reportApiModels}=await import('../lib/update-model.js');const seen=[]
 const fake=async(url,opts)=>{seen.push([url,opts]);if(url.endsWith('/models'))return Response.json({data:[{id:'public-model'}]});return url.endsWith('/messages')?Response.json({stop_reason:'end_turn',content:[{type:'text',text:'API报告'}]}):Response.json({choices:[{finish_reason:'stop',message:{content:'API报告'}}]})}
 for(const protocol of ['openai','anthropic']){const api={url:'https://provider.example/v1',key:'fixture-api-password',model:'public-model',protocol};assert.equal(await reportApiComplete(api,'只有公开证据',8192,AbortSignal.timeout(1000),fake),'API报告');assert.deepEqual(await reportApiModels(api,AbortSignal.timeout(1000),fake),['public-model'])}
 assert.equal(seen[0][1].headers.authorization,'Bearer fixture-api-password');assert.equal(seen[2][1].headers['x-api-key'],'fixture-api-password')
 assert.ok(seen.every(([,o])=>o.redirect==='error'));assert.equal(JSON.parse(seen[0][1].body).messages.length,1);assert.doesNotMatch(seen[0][1].body,/fixture-api-password/)
})
test('独立报告API不把截断当作成功，拒绝URL凭据，错误不包含远端正文',async()=>{
 const {reportApiComplete}=await import('../lib/update-model.js');const api={url:'https://provider.example/v1',key:'private-api-key',model:'test',protocol:'openai'}
 await assert.rejects(reportApiComplete(api,'public',512,AbortSignal.timeout(1000),async()=>Response.json({choices:[{finish_reason:'length',message:{content:'半截'}}]})),/截断/)
 await assert.rejects(reportApiComplete({...api,url:'https://user:password@provider.example/v1'},'public',512,AbortSignal.timeout(1000),async()=>{}),/不含密钥/)
 await assert.rejects(reportApiComplete(api,'public',512,AbortSignal.timeout(1000),async()=>new Response('private-api-key',{status:401})),e=>e.message.includes('401')&&!e.message.includes('private-api-key'))
})
test('API报告独立于dsh模型，输入/输出不含API地址密钥，保留原dsh选择',async t=>{
 const prompts=[];const h=harness(t,[source()],{fetch:async(url,opts)=>{if(String(url).endsWith('/chat/completions')){prompts.push(opts.body);return Response.json({choices:[{finish_reason:'stop',message:{content:'公开更新分析'}}]})}if(String(url).includes('osv.dev'))return Response.json({results:[{vulns:[]}]});return Response.json({versions:{'1.0.0':{},'1.1.0':{}}})}})
 Object.assign(h.config,{updatesModelSource:'api',updatesApiProtocol:'openai',updatesApiUrl:'https://private-provider.example/v1',updatesApiKey:'private-report-api-password',updatesApiModel:'fixture-model',updatesModelProvider:'saved-provider',updatesModel:'saved-model'})
 await h.monitor.check();assert.equal(h.monitor.snapshot().report.analyzed,1);assert.equal(prompts.length,1);assert.doesNotMatch(prompts[0],/private-provider|private-report-api-password|saved-provider/);assert.doesNotMatch(h.monitor.snapshot().report.markdown,/private-provider|private-report-api-password/);assert.equal(h.config.updatesModel,'saved-model')
})
test('关闭自动检查时仍可显式读取模型列表/测试API，API密钥不出现在返回状态中',async t=>{
 const h=harness(t,[],{fetch:async(url)=>String(url).endsWith('/models')?Response.json({data:[{id:'example-model'}]}):Response.json({choices:[{finish_reason:'stop',message:{content:'连接成功'}}]})});Object.assign(h.config,{updatesEnabled:false,updatesModelSource:'api',updatesApiProtocol:'openai',updatesApiUrl:'https://api.example.org/v1',updatesApiModel:'example-model',updatesApiKey:'fixture-api-key'})
 const request=async action=>{let status=0,text='';await h.monitor.handle({url:'/api/updates/'+action,method:'POST'},{writeHead:s=>status=s,end:s=>text=s},'/api/updates');return{status,json:JSON.parse(text)}}
 assert.deepEqual((await request('models')).json.models,['example-model']);assert.equal((await request('test-model')).json.text,'连接成功');assert.equal((await request('check')).status,409);assert.doesNotMatch(JSON.stringify(h.monitor.snapshot()),/fixture-api-key|https:\/\/api.example.org/)
})
test('连接测试期间可查询忙状态，拒绝重复测试，关闭自动检查不会取消手动测试',async t=>{
 let release;const gate=new Promise(r=>release=r);const h=harness(t,[],{fetch:async()=>{await gate;return Response.json({choices:[{finish_reason:'stop',message:{content:'连接成功'}}]})}});Object.assign(h.config,{updatesEnabled:false,updatesModelSource:'api',updatesApiProtocol:'openai',updatesApiUrl:'https://api.example.org/v1',updatesApiModel:'example-model',updatesApiKey:'fixture-api-key'})
 const request=async()=>{let status=0;await h.monitor.handle({url:'/api/updates/test-model',method:'POST'},{writeHead:s=>status=s,end:()=>{}},'/api/updates');return status}
 const running=request();assert.equal(h.monitor.snapshot().testingModel,true);assert.equal(await request(),409);await h.monitor.tick();release();assert.equal(await running,200);assert.equal(h.monitor.snapshot().testingModel,false)
})
