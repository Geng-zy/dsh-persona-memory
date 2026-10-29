import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

test('拆分迁移保留凭据和配置标识，按归属迁移设置，重复执行不重复插入', () => {
 const dir=mkdtempSync(join(tmpdir(),'companion-split-'))
 try{
  const archives=['dsh-qq-gateway','dsh-persona-memory'].map(name=>{
   const source=join(dir,name);execFileSync('mkdir',['-p',join(source,'package')]);writeFileSync(join(source,'package/package.json'),JSON.stringify({name,version:'2.0.0'}));const file=join(dir,name+'.tgz');execFileSync('tar',['-czf',file,'-C',source,'package']);return file
  })
  writeFileSync(join(dir,'package.json'),JSON.stringify({dsh:{profile:{bundles:['base','dsh-snowluma-companion','custom']}},dependencies:{'dsh-snowluma-companion':'old',custom:'1'}}))
  const patch="- id: snowluma-bridge\n  name: dsh-snowluma-companion\n  config:\n    workspacePath: /old/shared\n    ws_reverse_token: 'private-fixture-value'\n    groupWhitelist: ['555']\n- id: companion-core\n  name: dsh-snowluma-companion/companion\n  config:\n    imageGenEnabled: true\n    recallTopK: 7\n    backupItems: [persona, sessionsMaster, settingsBridge]\n    rules: [{kind: group, target: '555', maxRounds: 8, proactive: 'on'}]\n- id: companion-context\n  name: dsh-snowluma-companion/context\n"
  writeFileSync(join(dir,'cordis.patch.yml'),patch)
  const run=()=>execFileSync(process.execPath,[fileURLToPath(new URL('../deploy/migrate-profile.mjs',import.meta.url)),dir,...archives])
  run();const once=readFileSync(join(dir,'cordis.patch.yml'),'utf8');run();assert.equal(readFileSync(join(dir,'cordis.patch.yml'),'utf8'),once)
  const pkg=JSON.parse(readFileSync(join(dir,'package.json'),'utf8'));assert.deepEqual(pkg.dsh.profile.bundles,['base','dsh-qq-gateway','dsh-persona-memory','custom'])
  assert.ok(!once.includes('/old/shared'));assert.match(once,/workspacePath: ['"]{2}/);assert.ok(once.includes("'private-fixture-value'"));assert.ok(once.includes('sessionScope: qq'));assert.ok(once.includes('qqRules:'));assert.ok(once.includes('dsh-persona-memory/context'))
 }finally{rmSync(dir,{recursive:true,force:true})}
})

test('两个插件有独立入口、配置与预设，QQ不接管全局人格或上下文', () => {
 const qq=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'))
 const persona=JSON.parse(readFileSync(new URL('../packages/dsh-persona-memory/package.json',import.meta.url),'utf8'))
 assert.equal(qq.name,'dsh-qq-gateway');assert.equal(persona.name,'dsh-persona-memory')
 assert.equal(qq.exports['./companion'],undefined);assert.equal(qq.exports['./context'],undefined)
 assert.ok(persona.exports['./context'])
 const bridgePatch=readFileSync(new URL('../cordis.patch.yml',import.meta.url),'utf8')
 const personaPatch=readFileSync(new URL('../packages/dsh-persona-memory/cordis.patch.yml',import.meta.url),'utf8')
 assert.ok(!bridgePatch.includes('companion-core'))
 assert.equal((personaPatch.match(/dsh-persona-memory\/context/g)||[]).length,1)
 assert.ok(!personaPatch.includes('default: companion'))
})
