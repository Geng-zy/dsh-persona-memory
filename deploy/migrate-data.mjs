#!/usr/bin/env node
// Run as the dsh user, with dsh STOPPED and a rollback copy of the profile/workspace registry.
import {existsSync,readFileSync,writeFileSync,mkdirSync,cpSync,renameSync,rmSync,readdirSync,statSync,utimesSync} from 'node:fs'
import {resolve,join,dirname,relative} from 'node:path'
import {DatabaseSync} from 'node:sqlite'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import * as qq from '../lib/qq/backup.js'
import {createRequire} from 'node:module'
import {fileURLToPath,pathToFileURL} from 'node:url'
const require=createRequire(import.meta.url),sourceCore=fileURLToPath(new URL('../packages/dsh-persona-memory/lib/companion/backup.js',import.meta.url))
const coreBackup=existsSync(sourceCore)?sourceCore:join(dirname(require.resolve('dsh-persona-memory/package.json')),'lib/companion/backup.js')
const persona=await import(pathToFileURL(coreBackup).href)

const memoryTables=['memories','tombstones','consolidations','graph_entities','graph_edges','graph_mentions','graph_done','journal']
const digest=p=>createHash('sha256').update(readFileSync(p)).digest('hex')
function files(root,dir=root){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const p=join(dir,e.name);if(e.isSymbolicLink())throw new Error('Migration rejects symbolic links: '+p);return e.isDirectory()?files(root,p):e.isFile()?[relative(root,p).split('\\').join('/')]:[]})}
function splitDb(file,kind,backup=false){
 const db=new DatabaseSync(file)
 try{
  for(const table of kind==='qq'?memoryTables:['messages','retired'])db.exec('DROP TABLE IF EXISTS '+table)
  if(kind==='qq')db.exec("DELETE FROM meta WHERE key LIKE 'embed_dim:%' OR key LIKE 'care:%' OR key='selfcheck:last'")
  else db.exec("DELETE FROM meta WHERE key LIKE 'carry:%' OR key LIKE 'proactive:%'")
  if(backup&&kind==='qq')db.exec("DELETE FROM messages WHERE umo NOT IN (SELECT substr(key,5) FROM cursors WHERE key LIKE 'cat:%' AND value=1)")
  if(backup&&kind==='persona')db.exec('DELETE FROM journal')
  db.exec('VACUUM; PRAGMA journal_mode=DELETE;')
  if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Database integrity failure')
 }finally{db.close()}
}
function copyIf(source,target){if(!existsSync(source))return;mkdirSync(dirname(target),{recursive:true,mode:0o700});cpSync(source,target,{recursive:true})}
async function partitionBackup(source,target,kind){
 const engine=kind==='qq'?qq:persona,inspected=await engine.inspectBackup(source,join(target,'.inspect-source')),stage=inspected.dir
 try{
  const manifest=inspected.manifest,items=engine.itemsOf(manifest)
  if(!items.length)return
  const settings=engine.readSavedSettings(stage,items)
  if(kind==='persona'&&settings['companion-core']){const user=settings['companion-core'].user;for(const key of JSON.parse(readFileSync(new URL('./qq-config-fields.json',import.meta.url),'utf8')))delete user[key];if(Array.isArray(user.backupItems))user.backupItems=persona.cleanItems(user.backupItems);if(Array.isArray(user.rules))user.rules=user.rules.map(r=>Object.fromEntries(Object.entries(r).filter(([k])=>['kind','target','maxRounds','dropRounds','mode','forgetMode','note'].includes(k))))}
  if(kind==='qq'&&settings['snowluma-bridge']){const user=settings['snowluma-bridge'].user;if(Array.isArray(user.backupItems))user.backupItems=qq.configuredItems(user.backupItems)}
  const keep=new Set(engine.restoreContents(manifest).flatMap(row=>row.files.map(f=>f.path)))
  // Session attachments are referenced by master-sessions.json and remain within this backup.
  if(items.includes('sessionsMaster'))for(const f of manifest.files)if(f.path.startsWith('attachments/'))keep.add(f.path)
  for(const file of files(stage))if(file!=='manifest.json'&&!keep.has(file))rmSync(join(stage,file))
  rmSync(join(stage,'settings'),{recursive:true,force:true});rmSync(join(stage,'settings.json'),{force:true})
  for(const [ns,value]of Object.entries(settings)){mkdirSync(join(stage,'settings'),{recursive:true});writeFileSync(join(stage,'settings',ns+'.json'),JSON.stringify(value,null,2))}
  if(existsSync(join(stage,'companion.db')))splitDb(join(stage,'companion.db'),kind,true)
  if(kind==='qq'&&existsSync(join(stage,'media'))){
    const media=new Set(),dbPath=join(stage,'companion.db')
    if(existsSync(dbPath)){const db=new DatabaseSync(dbPath,{readOnly:true});try{for(const row of db.prepare("SELECT segments FROM messages WHERE segments IS NOT NULL").all())for(const m of row.segments.matchAll(/"_local":"([0-9a-f]{64}\.[a-z0-9]+)"/g))media.add(m[1])}finally{db.close()}}
    for(const file of files(join(stage,'media')))if(!media.has(file))rmSync(join(stage,'media',file))
  }
  const payload=files(stage).filter(p=>p!=='manifest.json').map(path=>({path,size:statSync(join(stage,path)).size,sha256:digest(join(stage,path))}))
  const counts={...manifest.counts,...(kind==='qq'?{memories:0,diaryDays:0,months:0}:{archiveMessages:0,media:0,masterSessions:0})}
  if(existsSync(join(stage,'companion.db'))){const db=new DatabaseSync(join(stage,'companion.db'),{readOnly:true});try{if(kind==='qq')counts.archiveMessages=db.prepare('SELECT COUNT(*) AS n FROM messages').get().n;else counts.memories=db.prepare('SELECT COUNT(*) AS n FROM memories').get().n}finally{db.close()}}
  const next={...manifest,owner:kind==='qq'?'dsh-qq-gateway':'dsh-persona-memory',plugin:'2.0.0',items,settings:{},counts,files:payload}
  writeFileSync(join(stage,'manifest.json'),JSON.stringify(next,null,2))
  const name=(kind==='qq'?'qq-gateway':'persona-memory')+source.match(/-(?:auto|manual|before-import)-\d{8}-\d{6}\.tar\.gz$/)[0]
  const output=join(target,name);execFileSync('tar',['-czf',output+'.part','-C',stage,'.']);renameSync(output+'.part',output)
  const verified=await engine.inspectBackup(output,join(target,'.inspect-verify'));rmSync(verified.dir,{recursive:true,force:true})
  const st=statSync(source);utimesSync(output,st.atime,st.mtime)
 }finally{rmSync(stage,{recursive:true,force:true})}
}
export async function migrateData(homeArg){
 const home=resolve(homeArg),old=join(home,'companion'),targets={qq:join(home,'qq-gateway'),persona:join(home,'persona-memory')}
 if(!existsSync(old))throw new Error('Legacy companion data directory missing; source has not been changed')
 for(const path of Object.values(targets))if(existsSync(path))throw new Error('Target already exists; inspect/rollback before retry: '+path)
 const stages=Object.fromEntries(Object.entries(targets).map(([key,value])=>[key,value+'.split-new']))
 for(const path of Object.values(stages))if(existsSync(path))throw new Error('Incomplete prior migration; inspect before retry: '+path)
 try{
  for(const path of Object.values(stages))mkdirSync(path,{recursive:true,mode:0o700})
  for(const name of ['persona','core','diary'])copyIf(join(old,name),join(stages.persona,name))
  for(const name of ['media','generated-images'])copyIf(join(old,name),join(stages.qq,name))
  copyIf(join(home,'snowluma-bridge','sessions.json'),join(stages.qq,'sessions.json'))
  // VACUUM INTO is a consistent snapshot; the legacy DB stays untouched for rollback.
  const dbFile=join(old,'companion.db')
  if(existsSync(dbFile)){const db=new DatabaseSync(dbFile,{readOnly:true});try{for(const[k,path]of Object.entries(stages)){const file=join(path,'companion.db');db.exec("VACUUM INTO '"+file.replaceAll("'","''")+"'");splitDb(file,k)}}finally{db.close()}}
  const oldBackups=qq.listBackups(join(old,'backups')).slice(0,5)
  for(const[k,path]of Object.entries(stages)){const output=join(path,'backups');mkdirSync(output,{recursive:true,mode:0o700});for(const backup of oldBackups)await partitionBackup(join(old,'backups',backup.name),output,k)}
  // Publish only complete partitions. If the second rename fails, undo the first.
  const published=[]
  try{for(const[k,path]of Object.entries(stages)){renameSync(path,targets[k]);published.push(k)}}catch(e){for(const k of published.reverse())renameSync(targets[k],stages[k]);throw e}
  return {legacyPreserved:true,qq:targets.qq,persona:targets.persona,backups:{qq:qq.listBackups(join(targets.qq,'backups')).length,persona:persona.listBackups(join(targets.persona,'backups')).length}}
 }catch(error){for(const path of Object.values(stages))rmSync(path,{recursive:true,force:true});throw error}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){if(!process.argv[2])throw new Error('Usage: node migrate-data.mjs <DSH_HOME>');console.log(JSON.stringify(await migrateData(process.argv[2])))}
