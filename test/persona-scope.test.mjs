import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Config, apply } from '../lib/companion/index.js'

test('人格插件默认不改变网页普通会话，只处理QQ；管理员/群/其他私聊使用各自核心记忆', async () => {
  const home=mkdtempSync(join(tmpdir(),'persona-scope-')),previous=process.env.DSH_HOME
  process.env.DSH_HOME=home
  const data=join(home,'persona-memory');mkdirSync(join(data,'persona'),{recursive:true});mkdirSync(join(data,'core'),{recursive:true})
  writeFileSync(join(data,'persona/persona.md'),'SYNTHETIC-PERSONA')
  for(const [file,text] of [['master','ADMIN-CORE'],['public','PUBLIC-CORE'],['group','GROUP-CORE'],['private','PRIVATE-CORE']])writeFileSync(join(data,'core',file+'.md'),text)
  const events=new Map(),services=new Map(),cleanups=[]
  const info=new Map([['admin',{type:'private',adminPrivate:true,userId:'42',umo:'snowluma:FriendMessage:42'}],['group',{type:'group',adminPrivate:false,groupId:'555',umo:'snowluma:GroupMessage:555'}],['private',{type:'private',adminPrivate:false,userId:'77',umo:'snowluma:FriendMessage:77'}]])
  const registered=new Map();let scopeSetting='qq';
  const web={session:{id:'web-session',meta:{agentPreset:'standard'}},ctx:{tools:{register:def=>{assert.equal(scopeSetting,'all');registered.set(def.name,def);return()=>registered.delete(def.name)}}}}
  services.set('snowluma',{sessionInfo:id=>info.get(id),canArchive:()=>true})
  services.set('agents',{list:()=>[web]})
  const ctx={get:key=>services.get(key),provide:(key,value)=>services.set(key,value),on:(name,fn)=>{events.set(name,[...(events.get(name)??[]),fn]);return()=>{}},effect:fn=>{const cleanup=fn();if(typeof cleanup==='function')cleanups.push(cleanup)},inject:()=>{}}
  const live=Config({logLevel:'error'});live.sessionScope={get:()=>scopeSetting}
  try{
    await apply(ctx,live)
    const service=services.get('companion')
    assert.equal(service.contextPolicy('web-session','standard'),undefined)
    assert.throws(()=>service.identity({sessionId:'web-session'}),/生效范围/)
    assert.match(service.identity({sessionId:'admin'}).core,/ADMIN-CORE/)
    assert.doesNotMatch(service.identity({sessionId:'group'}).core,/ADMIN-CORE|PRIVATE-CORE/)
    assert.match(service.identity({sessionId:'group'}).core,/GROUP-CORE/)
    assert.match(service.identity({sessionId:'private'}).core,/PRIVATE-CORE/)
    assert.doesNotMatch(service.identity({sessionId:'private'}).core,/ADMIN-CORE|GROUP-CORE/)
    const assembly={sections:[{key:'identity',content:'STANDARD-IDENTITY'}]}
    const hook=events.get('system-prompt/assemble')[0]
    assert.equal(await hook({}, {agent:web},async()=>assembly),assembly)
    assert.equal(registered.size,0)
    const toolHook=events.get('agent/pre-step').at(-1)
    scopeSetting='all';await toolHook({agent:web},async()=>{})
    assert.ok(registered.has('memory_search'));assert.ok(registered.has('persona_edit'))
    scopeSetting='qq';await toolHook({agent:web},async()=>{})
    assert.equal(registered.size,0,'更改生效范围后，已有网页会话下一步移除人格记忆工具，无需reset')
    assert.throws(()=>service.identity({sessionId:'web-session'}),/生效范围/)
    await service.remember('GROUP UNIQUE SECRET',{by:'test',sessionId:'group',kind:'fact',importance:1})
    assert.equal((await service.recall('GROUP UNIQUE SECRET',{sessionId:'private'})).length,0)
    assert.ok((await service.recall('GROUP UNIQUE SECRET',{sessionId:'group'})).length>0)
    assert.ok((await service.recall('GROUP UNIQUE SECRET',{sessionId:'admin'})).length>0)
    await assert.rejects(service.remember('WEB EXCLUDED',{by:'test',sessionId:'web-session'}),/生效范围/)
  }finally{for(const cleanup of cleanups.reverse())await cleanup();if(previous===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=previous;rmSync(home,{recursive:true,force:true})}
})
