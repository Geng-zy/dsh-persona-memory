import {tokenizer,parse} from 'acorn'
export function externalImports(text){
 const t=[...tokenizer(text,{ecmaVersion:'latest',sourceType:'module',allowHashBang:true})],out=new Set()
 const add=x=>{if(x?.type.label!=='string')return;const s=x.value;if(s.startsWith('.')||s.startsWith('node:'))return;const name=s.startsWith('@')?s.split('/').slice(0,2).join('/'):s.split('/')[0];if(/^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i.test(name))out.add(name)}
 for(let i=0;i<t.length;i++){if(t[i].type.label==='import'||t[i].type.label==='name'&&t[i].value==='from')add(t[i+1]);if((t[i].type.label==='import'||t[i].value==='require')&&t[i+1]?.type.label==='(')add(t[i+2])}
 return [...out]
}

export function staticProviderIds(text){
 const found=new Set();const walk=n=>{if(!n||typeof n!=='object')return;
  if(n.type==='ObjectExpression'){const props=new Map(n.properties.filter(p=>p.type==='Property').map(p=>[p.key.name??p.key.value,p.value]));if(props.get('id')?.type==='Literal'&&props.get('url')?.type==='Literal')found.add(props.get('id').value)}
  if(n.type==='VariableDeclarator'&&n.id.name==='templates'&&n.init?.type==='ArrayExpression')for(const row of n.init.elements)if(row?.type==='ArrayExpression'&&row.elements[0]?.type==='Literal')found.add(row.elements[0].value)
  for(const [key,v]of Object.entries(n))if(key!=='start'&&key!=='end')if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v)
 };walk(parse(text,{ecmaVersion:'latest',sourceType:'module'}));return [...found]
}
