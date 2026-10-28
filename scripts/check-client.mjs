import { parse } from 'acorn'
import { readFileSync } from 'node:fs'
for (const file of ['bridge','companion','client']) {
 const source=readFileSync(new URL('../src/client/'+file+'.js',import.meta.url),'utf8')
 const tree=parse(source,{ecmaVersion:'latest',sourceType:'script'})
 function visit(node) {
  if(!node || typeof node!=='object')return
  if(node.type==='VariableDeclarator'&&['zh','en'].includes(node.id.name)&&node.init?.type==='ObjectExpression') {
   const keys=node.init.properties.map(p=>p.key.name??p.key.value)
   if(new Set(keys).size!==keys.length)throw new Error(file+': duplicate dictionary key')
  }
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value)
 }
 visit(tree)
}
console.log('All unified client dictionaries checked')
