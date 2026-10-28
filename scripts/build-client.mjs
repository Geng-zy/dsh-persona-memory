import { readFileSync, writeFileSync } from 'node:fs'
const root = new URL('../', import.meta.url)
const files = ['layout.js', 'bridge.js', 'companion.js', 'client.js']
const javascript = files.map(name => readFileSync(new URL('src/client/' + name, root), 'utf8')).join('\n')
const css = readFileSync(new URL('src/client/style.css', root), 'utf8')
const theme = `\nif (typeof document !== 'undefined' && !document.getElementById('snowluma-companion-theme')) { const style = document.createElement('style'); style.id = 'snowluma-companion-theme'; style.textContent = ${JSON.stringify(css)}; document.head.appendChild(style); }\n`
writeFileSync(new URL('lib/client.js', root), javascript + theme)
