#!/usr/bin/env node
// Run with dsh stopped. Keep namespace IDs and secret scalar nodes; move only owned settings.
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { parseDocument, YAMLMap, YAMLSeq } from 'yaml'
import { execFileSync } from 'node:child_process'
const [profileArg, qqArg, personaArg] = process.argv.slice(2)
if (!profileArg || !qqArg || !personaArg) throw new Error('Usage: node migrate-profile.mjs <profile-directory> <qq-package.tgz> <persona-package.tgz>')
const profile=resolve(profileArg),archives=[resolve(qqArg),resolve(personaArg)],names=['dsh-qq-gateway','dsh-persona-memory']
for(const [i,file] of archives.entries()){
 if(!existsSync(file))throw new Error('Plugin archive missing')
 const p=JSON.parse(execFileSync('tar',['-xOzf',file,'package/package.json'],{encoding:'utf8'}))
 if(p.name!==names[i])throw new Error('Plugin archive name mismatch: '+names[i])
}
const packageFile=join(profile,'package.json'),pkg=JSON.parse(readFileSync(packageFile,'utf8'))
const legacy=new Set(['dsh-snowluma-companion','dsh-snowluma-bridge','dsh-companion-core'])
if(!Array.isArray(pkg.dsh?.profile?.bundles))throw new Error('No dsh profile bundle list; nothing changed')
const firstMigration=pkg.dsh.profile.bundles.some(n=>legacy.has(n))
let added=false
pkg.dsh.profile.bundles=pkg.dsh.profile.bundles.flatMap(value=>{
 if(legacy.has(value)||names.includes(value)){if(added)return[];added=true;return names}return[value]
})
if(!added)pkg.dsh.profile.bundles.push(...names)
pkg.dependencies??={};for(const name of legacy)delete pkg.dependencies[name]
for(const [i,name]of names.entries())pkg.dependencies[name]='file:'+archives[i]
const qqFields=new Set(JSON.parse(readFileSync(new URL('./qq-config-fields.json',import.meta.url),'utf8')))
const references={'dsh-snowluma-companion':names[0],'dsh-snowluma-bridge':names[0],'dsh-snowluma-companion/companion':names[1],'dsh-companion-core':names[1],'dsh-snowluma-companion/context':names[1]+'/context','dsh-companion-core/context':names[1]+'/context'}
const updates=[]
for(const filename of ['cordis.yml','cordis.patch.yml']){
 const file=join(profile,filename);if(!existsSync(file))continue
 const document=parseDocument(readFileSync(file,'utf8'),{keepSourceTokens:true})
 if(document.errors.length||!(document.contents instanceof YAMLSeq))throw new Error('Cannot safely parse profile configuration: '+filename)
 const rows=document.contents.items.filter(r=>r instanceof YAMLMap)
 function config(id){let row=rows.find(r=>r.get('id')===id);if(!row){row=document.createNode({id,config:{}});document.contents.add(row);rows.push(row)}let value=row.get('config',true);if(!(value instanceof YAMLMap)){value=new YAMLMap();row.set('config',value)}return value}
 function rename(node){if(node instanceof YAMLMap){const name=node.get('name');if(references[name])node.set('name',references[name]);for(const pair of node.items)rename(pair.value)}else if(node instanceof YAMLSeq)node.items.forEach(rename)}
 rename(document.contents)
 const companion=rows.find(r=>r.get('id')==='companion-core')?.get('config',true)
 if(companion instanceof YAMLMap){
  const bridge=config('snowluma-bridge')
  for(const field of qqFields)if(companion.has(field)){if(!bridge.has(field))bridge.set(field,companion.get(field,true).clone());companion.delete(field)}
  for(const field of ['timezone','silenceToken'])if(companion.has(field)&&!bridge.has(field))bridge.set(field,companion.get(field,true).clone())
  const rules=companion.get('rules',true)
  if(rules instanceof YAMLSeq && !bridge.has('qqRules')){
   const own=rules.toJSON().map(r=>Object.fromEntries(Object.entries(r).filter(([k])=>['kind','target','archiveDays','archiveUnwoken','proactive','note'].includes(k))))
   bridge.set('qqRules',document.createNode(own))
   companion.set('rules',document.createNode(rules.toJSON().map(r=>Object.fromEntries(Object.entries(r).filter(([k])=>['kind','target','maxRounds','dropRounds','mode','forgetMode','note'].includes(k))))))
  }
  const oldBackup=companion.get('backupItems')
  if(oldBackup){const items=oldBackup.toJSON?oldBackup.toJSON():oldBackup
   if(Array.isArray(items)){
    if(!bridge.has('backupItems'))bridge.set('backupItems',document.createNode(items.map(i=>i==='archiveOthers'?'sessionsMaster':i).filter(i=>['archiveMaster','sessionsMaster','settingsBridge'].includes(i))))
    companion.set('backupItems',document.createNode(items.filter(i=>['persona','core','diary','memory','settingsCompanion'].includes(i))))
   }
  }
  for(const key of ['backupEnabled','backupTime','backupKeep'])if(companion.has(key)&&!bridge.has(key))bridge.set(key,companion.get(key,true).clone())
  if(firstMigration)companion.set('sessionScope','qq')
 }
 updates.push([file,String(document)])
}
// Prepare all files before replacing either; operators retain deployment rollback metadata.
for(const [file,value]of [[packageFile,JSON.stringify(pkg,null,2)+'\n'],...updates])writeFileSync(file+'.split-new',value)
for(const file of [packageFile,...updates.map(([file])=>file)])renameSync(file+'.split-new',file)
console.log('Profile references two independent plugins; settings moved by ownership, secrets retained. QQ session/history migration runs at plugin startup.')
