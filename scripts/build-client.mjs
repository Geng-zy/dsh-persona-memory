import {readFileSync,writeFileSync} from 'node:fs'
const root=new URL('../',import.meta.url),name="dsh-persona-memory"
const layout=readFileSync(new URL('src/client/layout.js',root),'utf8').replaceAll('dsh-snowluma-companion',name).replaceAll('snowluma-companion:',name+':')
const javascript=[layout,...["companion.js", "persona-entry.js"].map(f=>readFileSync(new URL('src/client/'+f,root),'utf8'))].join('\n')
const css=readFileSync(new URL('src/client/style.css',root),'utf8')
const theme=`\nif(typeof document!=='undefined'&&!document.getElementById('qq-persona-shared-theme')){const style=document.createElement('style');style.id='qq-persona-shared-theme';style.textContent=${JSON.stringify(css)};document.head.appendChild(style)}\n`
writeFileSync(new URL('lib/client.js',root),javascript+theme)
