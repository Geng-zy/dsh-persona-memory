import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
test('installer validation, private credentials, extraction, coherent configuration, resume and readiness',()=>{
 const root=fileURLToPath(new URL('../',import.meta.url))
 execFileSync('bash',['-n','install.sh'],{cwd:root})
 execFileSync('python3',['-m','unittest','discover','-s','test/installer','-p','test_*.py'],{cwd:root,stdio:'pipe'})
 assert.ok(true)
})
