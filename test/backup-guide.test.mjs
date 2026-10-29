import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {execFileSync} from 'node:child_process'
import {Archive} from '../lib/companion/archive.js'
import {createBackup,inspectBackup,restoreContents,applyPendingImport,itemsOf} from '../lib/companion/backup.js'
import {describeSettings} from '../lib/companion/backup-guide.js'
import {Config} from '../lib/companion/index.js'
const OWNER='dsh-persona-memory',isQq=OWNER==='dsh-qq-gateway'
const load=p=>JSON.parse(readFileSync(p,'utf8'))
test('导出包实际逐文件说明、设置字段、真实SQLite结构与校验；说明文件不作为恢复数据',async t=>{
 const home=mkdtempSync(join(tmpdir(),'backup-guide-'));t.after(()=>rmSync(home,{recursive:true,force:true}))
 const data=join(home,'data');mkdirSync(data);const archive=new Archive(join(data,'companion.db'),true)
 if(isQq){archive.setCursor('cat:snowluma:FriendMessage:42',1);archive.add({umo:'snowluma:FriendMessage:42',kind:'private',userId:'42',time:1000,direction:'in',senderId:'42',senderName:'owner',woke:true,type:'message',text:'UNIQUE RAW CONTENT'})}
 else{
  mkdirSync(join(data,'persona'));writeFileSync(join(data,'persona/persona.md'),'UNIQUE PERSONA CONTENT')
  archive.db.prepare("INSERT INTO memories(scope,kind,content,importance,trust,writer,created_at,tz,hash) VALUES('master','fact','UNIQUE PRIVATE MEMORY',1,1,'test',1000,'Asia/Shanghai','test-hash')").run()
 }
 const ns=isQq?'snowluma-bridge':'companion-core',key=isQq?'typingCharsPerMinute':'recallTopK'
 const chosen=isQq?['archiveMaster','settingsBridge']:['persona','memory','settingsCompanion']
 const result=await createBackup({dataDir:data,db:archive.db,outDir:join(home,'backups'),reason:'manual',plugin:'test',schema:5,settings:{[key]:6},embed:{},keep:5,items:chosen,settingsFiles:{[ns]:{ns,user:{[key]:6}}},settingDescriptions:describeSettings(Config)})
 const verified=await inspectBackup(join(home,'backups',result.name),join(home,'inspected'))
 const index=load(join(verified.dir,'migration/files.json')),schema=load(join(verified.dir,'migration/sqlite-schema.json')),guide=readFileSync(join(verified.dir,'migration/README.md'),'utf8')
 assert.equal(index.owner,OWNER);assert.deepEqual(index.selectedItems,chosen)
 assert.deepEqual(new Set(index.files.map(f=>f.path)),new Set(['manifest.json',...result.manifest.files.map(f=>f.path)]))
 assert.ok(result.manifest.files.every(f=>typeof f.description==='string'&&f.description.length>0))
 assert.ok(index.files.every(f=>f.description&&f.format&&f.migration.length))
 assert.equal(index.files.find(f=>f.path==='settings/'+ns+'.json').fields[key].description,describeSettings(Config)[key])
 assert.ok(!guide.includes('UNIQUE PERSONA CONTENT')&&!guide.includes('UNIQUE PRIVATE MEMORY')&&!guide.includes('UNIQUE RAW CONTENT'),'说明不重复业务正文')
 assert.ok(guide.split('\n').length>20&&guide.includes('| migration/files.json |'),'Markdown说明具有真实换行和完整文件名')
 assert.ok(guide.includes('master不可公开')&&guide.includes('superseded_by')&&guide.includes('目标插件'))
 const table=schema.tables.find(t=>t.name===(isQq?'messages':'memories'));assert.equal(table.rowCount,1);assert.ok(table.sql.startsWith('CREATE TABLE'));assert.ok(table.columns.every(c=>c.name&&c.type&&c.description))
 assert.ok(schema.tables.every(t=>t.name!==(isQq?'memories':'messages')))
 if(!isQq){assert.ok(table.columns.find(c=>c.name==='scope').description.includes('group:'));assert.ok(table.columns.find(c=>c.name==='superseded_by').description.includes('memories.id'));assert.ok(schema.embedding.reuse.includes('正文'))}
 assert.ok(restoreContents(result.manifest).every(row=>row.files.every(f=>!f.path.startsWith('migration/'))))
 archive.close()
 const selection=isQq?['archiveMaster']:['persona']
 writeFileSync(join(verified.dir,'restore.json'),JSON.stringify({items:selection}))
 const {renameSync}=await import('node:fs');renameSync(verified.dir,join(data,'.pending-import'))
 const imported=await applyPendingImport(data);assert.deepEqual(imported.plan.items,selection)
 assert.ok(!existsSync(join(data,'migration')),'说明不会写入插件的业务目录')
 // Newly added documentation is hashed and cannot be silently altered.
 const bad=await inspectBackup(join(home,'backups',result.name),join(home,'bad-source'))
 writeFileSync(join(bad.dir,'migration/README.md'),guide+'tampered')
 const corrupt=join(home,'corrupt.tar.gz');execFileSync('tar',['-czf',corrupt,'-C',bad.dir,'.'])
 await assert.rejects(inspectBackup(corrupt,join(home,'bad-destination')),/校验/)
 assert.deepEqual(itemsOf({...result.manifest,owner:isQq?'dsh-persona-memory':'dsh-qq-gateway'}),[])
})
test('只选设置时只说明实际文件，无虚构数据库或其他业务数据；旧无说明包兼容',async t=>{
 const home=mkdtempSync(join(tmpdir(),'backup-guide-settings-'));t.after(()=>rmSync(home,{recursive:true,force:true}))
 const archive=new Archive(':memory:',true);t.after(()=>archive.close())
 const ns=isQq?'snowluma-bridge':'companion-core',item=isQq?'settingsBridge':'settingsCompanion'
 const result=await createBackup({dataDir:home,db:archive.db,outDir:join(home,'backups'),reason:'manual',plugin:'test',schema:5,settings:{},embed:{},keep:5,items:[item],settingsFiles:{[ns]:{ns,user:{}}}})
 const {dir,manifest}=await inspectBackup(join(home,'backups',result.name),join(home,'inspect'))
 assert.ok(!existsSync(join(dir,'migration/sqlite-schema.json')))
 assert.ok(!load(join(dir,'migration/files.json')).files.some(f=>f.path==='companion.db'))
 assert.ok(!manifest.files.some(f=>f.path.startsWith('persona/')||f.path.startsWith('media/')))
 // Strip the optional additive metadata to simulate an older format-3 export.
 rmSync(join(dir,'migration'),{recursive:true});manifest.files=manifest.files.filter(f=>!f.path.startsWith('migration/')).map(({path,size,sha256})=>({path,size,sha256}))
 writeFileSync(join(dir,'manifest.json'),JSON.stringify(manifest));const legacy=join(home,'legacy.tar.gz');execFileSync('tar',['-czf',legacy,'-C',dir,'.'])
 assert.deepEqual((await inspectBackup(legacy,join(home,'legacy-inspected'))).manifest.items,[item])
})
test('设置说明只读取schema说明，排除secret元信息而不是导出凭据或默认值',()=>{
 assert.deepEqual(describeSettings({dict:{visible:{meta:{description:'字段用途',default:'PRIVATE DEFAULT'}},key:{meta:{role:'secret',description:'密钥'}}}}),{visible:'字段用途'})
})
