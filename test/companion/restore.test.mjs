import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { inspectBackup, restoreContents, BACKUP_FORMAT } from '../../lib/companion/backup.js'

const manifest = files => ({format:BACKUP_FORMAT, formatVersion:3, items:['persona','core','memory','archiveMaster'], files})
test('restore inventory groups actual files and keeps shared database categories independent', () => {
 const entries=restoreContents(manifest(['persona/persona.md','core/master.md','core/public.md','companion.db','media/a.png'].map(path=>({path,size:12}))))
 assert.deepEqual(entries.map(e=>e.item),['persona','core','memory','archiveMaster'])
 assert.deepEqual(entries.find(e=>e.item==='core').files.map(f=>f.path),['core/master.md','core/public.md'])
 assert.deepEqual(entries.find(e=>e.item==='memory').files,[{path:'companion.db',size:12}])
 assert.equal(entries.find(e=>e.item==='archiveMaster').files.length,2)
 const legacy=restoreContents({files:[{path:'settings.json',size:2}]})
 assert.deepEqual(legacy.find(e=>e.item==='settingsCompanion').files,[{path:'settings.json',size:2}])
})
test('uploaded backup rejects links, unlisted payloads and invalid hashes, and removes rejected staging', async t => {
 const root=mkdtempSync(join(tmpdir(),'companion-restore-'));t.after(()=>rmSync(root,{recursive:true,force:true}))
 const src=join(root,'src');mkdirSync(src)
 const payload='safe persona';writeFileSync(join(src,'persona.md'),payload)
 const file={path:'persona.md',size:Buffer.byteLength(payload),sha256:createHash('sha256').update(payload).digest('hex')}
 const pack=()=>execFileSync('tar',['-czf',join(root,'upload.tar.gz'),'-C',src,'.'])
 writeFileSync(join(src,'manifest.json'),JSON.stringify(manifest([file])))
 pack();await inspectBackup(join(root,'upload.tar.gz'),join(root,'good'))
 symlinkSync('../outside',join(src,'link'));pack()
 await assert.rejects(inspectBackup(join(root,'upload.tar.gz'),join(root,'links')),/链接|特殊文件/)
 assert.equal(existsSync(join(root,'links')),false);rmSync(join(src,'link'))
 writeFileSync(join(src,'unlisted.txt'),'not in manifest');pack()
 await assert.rejects(inspectBackup(join(root,'upload.tar.gz'),join(root,'unlisted')),/清单不一致/)
 rmSync(join(src,'unlisted.txt'));writeFileSync(join(src,'persona.md'),'tampered');pack()
 await assert.rejects(inspectBackup(join(root,'upload.tar.gz'),join(root,'corrupt')),/校验值/)
 assert.equal(existsSync(join(root,'corrupt')),false)
})
