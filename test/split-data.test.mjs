import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync,cpSync,statSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {DatabaseSync} from 'node:sqlite'
import {Archive} from '../lib/companion/archive.js'
import {MemoryStore} from '../lib/companion/memory.js'
import {migrateData} from '../deploy/migrate-data.mjs'
import * as qq from '../lib/qq/backup.js'
import * as persona from '../lib/companion/backup.js'
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex')
test('旧统一数据和五个备份分别拆分，原文件不变；QQ包不含人格记忆，核心包不含QQ存档',async()=>{
 const home=mkdtempSync(join(tmpdir(),'split-data-')),old=join(home,'companion');mkdirSync(join(old,'backups'),{recursive:true});mkdirSync(join(old,'core'));mkdirSync(join(old,'persona'));mkdirSync(join(home,'snowluma-bridge'))
 writeFileSync(join(old,'core/master.md'),'ADMIN CORE BYTES\n');writeFileSync(join(old,'persona/persona.md'),'PERSONA BYTES\n');writeFileSync(join(home,'snowluma-bridge/sessions.json'),'{"qq":"old-session"}')
 const archive=new Archive(join(old,'companion.db')),store=new MemoryStore(archive.db)
 archive.add({umo:'snowluma:FriendMessage:42',kind:'private',userId:'42',time:100,direction:'in',senderId:'42',senderName:'owner',woke:true,type:'message',text:'RAW-HISTORY'})
 archive.setCursor('cat:snowluma:FriendMessage:42',1)
 archive.add({umo:'snowluma:GroupMessage:555',kind:'group',groupId:'555',time:101,direction:'in',senderId:'77',senderName:'group',woke:true,type:'message',text:'GROUP RAW NOT BACKED UP'})
 store.add({scope:'master',content:'ADMIN MEMORY',kind:'fact',importance:1,trust:1,writer:'test'})
 archive.close();const before=hash(join(old,'companion.db'))
 const stage=join(home,'fixture');mkdirSync(join(stage,'settings'),{recursive:true});mkdirSync(join(stage,'core'));mkdirSync(join(stage,'persona'))
 cpSync(join(old,'companion.db'),join(stage,'companion.db'));cpSync(join(old,'core/master.md'),join(stage,'core/master.md'));cpSync(join(old,'persona/persona.md'),join(stage,'persona/persona.md'))
 writeFileSync(join(stage,'settings/companion-core.json'),JSON.stringify({ns:'companion-core',user:{personaMaxChars:2345,groupContextCount:7,proactiveEnabled:false}}))
 writeFileSync(join(stage,'settings/snowluma-bridge.json'),JSON.stringify({ns:'snowluma-bridge',user:{wakeKeywords:['fish']}}))
 const paths=['companion.db','core/master.md','persona/persona.md','settings/companion-core.json','settings/snowluma-bridge.json']
 const manifest={format:'dsh-companion-backup',formatVersion:3,plugin:'1.4.3',schema:5,createdAt:1,reason:'manual',items:['persona','core','memory','archiveMaster','settingsCompanion','settingsBridge'],counts:{memories:1,archiveMessages:1,diaryDays:0,months:0,media:0},range:{},embed:{},settings:{},files:paths.map(path=>({path,sha256:hash(join(stage,path)),size:statSync(join(stage,path)).size}))}
 writeFileSync(join(stage,'manifest.json'),JSON.stringify(manifest))
 for(let i=1;i<=5;i++)execFileSync('tar',['-czf',join(old,'backups','companion-manual-20261029-10000'+i+'.tar.gz'),'-C',stage,'.'])
 try{
  const report=await migrateData(home);assert.deepEqual(report.backups,{qq:5,persona:5});assert.equal(hash(join(old,'companion.db')),before)
  assert.equal(readFileSync(join(home,'persona-memory/core/master.md'),'utf8'),'ADMIN CORE BYTES\n');assert.equal(readFileSync(join(home,'qq-gateway/sessions.json'),'utf8'),'{"qq":"old-session"}')
  for(const[k,own,absent]of [['qq-gateway','messages','memories'],['persona-memory','memories','messages']]){
   const db=new DatabaseSync(join(home,k,'companion.db'));try{const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name);assert.ok(tables.includes(own));assert.ok(!tables.includes(absent))}finally{db.close()}
   const engine=k==='qq-gateway'?qq:persona
   const pkg=join(home,k,'backups',readdirSync(join(home,k,'backups'))[0]),ex=await engine.inspectBackup(pkg,join(home,'verify-'+k))
   assert.ok(engine.itemsOf(ex.manifest).length);assert.deepEqual((k==='qq-gateway'?persona:qq).itemsOf(ex.manifest),[])
   const settings=engine.readSavedSettings(ex.dir,engine.itemsOf(ex.manifest))
   if(k==='qq-gateway'){assert.equal(ex.manifest.counts.archiveMessages,1);const backupDb=new DatabaseSync(join(ex.dir,'companion.db'));try{assert.equal(backupDb.prepare("SELECT COUNT(*) AS n FROM messages WHERE kind='group'").get().n,0)}finally{backupDb.close()};assert.equal(settings['snowluma-bridge'].user.groupContextCount,7);assert.ok(!ex.manifest.files.some(f=>f.path.startsWith('core/')||f.path.startsWith('persona/')))}
   else {assert.equal(settings['companion-core'].user.personaMaxChars,2345);assert.equal(settings['companion-core'].user.groupContextCount,undefined);assert.ok(!ex.manifest.files.some(f=>f.path.startsWith('settings/snowluma')))}
  }
  await assert.rejects(migrateData(home),/Target already exists/)
 }finally{rmSync(home,{recursive:true,force:true})}
})
