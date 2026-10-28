import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

test('合并迁移只保留一个 bundle，保留设置标识、凭据和预设覆盖，重复执行不重复插入', () => {
 const dir=mkdtempSync(join(tmpdir(),'companion-merge-'))
 try {
  const tgz=join(dir,'plugin.tgz');writeFileSync(tgz,'fixture')
  const original={name:'web',dsh:{profile:{bundles:['base','dsh-snowluma-bridge','custom','dsh-companion-core']}},dependencies:{'dsh-snowluma-bridge':'old','dsh-companion-core':'old','custom':'1'}}
  writeFileSync(join(dir,'package.json'),JSON.stringify(original))
  const patch="- id: snowluma-bridge\n  name: 'dsh-snowluma-bridge'\n  config:\n    ws_reverse_token: 'private-fixture-value'\n    groupWhitelist: ['555']\n- id: companion-core\n  name: dsh-companion-core\n  config:\n    backupItems: [persona, sessionsMaster]\n- id: companion-context\n  name: 'dsh-companion-core/context'\n"
  writeFileSync(join(dir,'cordis.patch.yml'),patch)
  const run=()=>execFileSync(process.execPath,[fileURLToPath(new URL('../deploy/migrate-profile.mjs',import.meta.url)),dir,tgz])
  run();run()
  const pkg=JSON.parse(readFileSync(join(dir,'package.json'),'utf8'))
  assert.deepEqual(pkg.dsh.profile.bundles,['base','dsh-snowluma-companion','custom'])
  assert.deepEqual(Object.keys(pkg.dependencies).sort(),['custom','dsh-snowluma-companion'])
  const updated=readFileSync(join(dir,'cordis.patch.yml'),'utf8')
  assert.equal(updated,patch.replace("name: 'dsh-snowluma-bridge'","name: 'dsh-snowluma-companion'").replace('name: dsh-companion-core','name: dsh-snowluma-companion/companion').replace("name: 'dsh-companion-core/context'","name: 'dsh-snowluma-companion/context'"))
 } finally {rmSync(dir,{recursive:true,force:true})}
})

test('统一包包含桥接、陪伴服务与上下文模块，预设只替换一次压缩引擎', () => {
 const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'))
 assert.equal(pkg.name,'dsh-snowluma-companion')
 assert.ok(pkg.exports['./companion']);assert.ok(pkg.exports['./context'])
 const patch=readFileSync(new URL('../cordis.patch.yml',import.meta.url),'utf8')
 assert.equal((patch.match(/name: 'dsh-snowluma-companion'/g)||[]).length,1)
 assert.equal((patch.match(/name: 'dsh-snowluma-companion\/companion'/g)||[]).length,1)
 assert.equal((patch.match(/name: 'dsh-snowluma-companion\/context'/g)||[]).length,1)
 assert.ok(!patch.includes("name: '@deepseek-ai/dsh-compaction-basic'"))
})
