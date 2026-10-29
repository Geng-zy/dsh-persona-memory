import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs'
const root=new URL('../',import.meta.url),persona=new URL('packages/dsh-persona-memory/',root)
function buildClient(name,files){
 const layout=readFileSync(new URL('src/client/layout.js',root),'utf8').replaceAll('dsh-snowluma-companion',name).replaceAll('snowluma-companion:',name+':')
 const javascript=[layout,...files.map(f=>readFileSync(new URL('src/client/'+f,root),'utf8'))].join('\n')
 const css=readFileSync(new URL('src/client/style.css',root),'utf8')
 const theme=`\nif(typeof document!=='undefined'&&!document.getElementById('qq-persona-shared-theme')){const style=document.createElement('style');style.id='qq-persona-shared-theme';style.textContent=${JSON.stringify(css)};document.head.appendChild(style)}\n`
 return javascript+theme
}
writeFileSync(new URL('lib/client.js',root),buildClient('dsh-qq-gateway',['bridge.js','qq-extra.js','qq-entry.js']))
rmSync(new URL('lib/',persona),{recursive:true,force:true});mkdirSync(new URL('lib/types/',persona),{recursive:true})
cpSync(new URL('lib/companion/',root),new URL('lib/companion/',persona),{recursive:true})
cpSync(new URL('lib/types/companion/',root),new URL('lib/types/companion/',persona),{recursive:true})
for(const file of ['image-tool','proactive','archived-image'])for(const [folder,ext]of [['lib/companion/','.js'],['lib/types/companion/','.d.ts']])rmSync(new URL(folder+file+ext,persona),{force:true})
cpSync(new URL('lib/models.js',root),new URL('lib/models.js',persona));cpSync(new URL('lib/types/models.d.ts',root),new URL('lib/types/models.d.ts',persona))
writeFileSync(new URL('lib/client.js',persona),buildClient('dsh-persona-memory',['companion.js','persona-entry.js']))
for(const file of ['LICENSE','NOTICE.md'])cpSync(new URL(file,root),new URL(file,persona))

mkdirSync(new URL('docs/',persona),{recursive:true});for(const file of ['PERSONA.md','SPLIT-MIGRATION.md'])cpSync(new URL('docs/'+file,root),new URL('docs/'+file,persona))
