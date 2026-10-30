import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import {parse} from 'acorn'

// Exercise the actual component event handler with the same props its parent supplies.
const code=readFileSync(new URL('../src/client/companion.js',import.meta.url),'utf8')
let declaration
function walk(node){if(!node||typeof node!=='object')return;if(node.type==='FunctionDeclaration'&&node.id?.name==='DshModelPick')declaration=node;for(const v of Object.values(node))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v)}
walk(parse(code,{ecmaVersion:'latest',sourceType:'script'}))
assert.ok(declaration)
for(const task of ['memory','summary','graph'])test(task+' configured model selection uses the shared form editor',()=>{
 const state={[task+'Model']:{text:''},[task+'Effort']:{text:'low'}},changes=[]
 let hook=0
 const sandbox={React:{useState:()=>[[{providers:[{id:'configured',name:'Configured',models:[{id:'vendor/model-v1',name:'Fixture'}]}]},null,null][hook++],()=>{}],useEffect:()=>{}},h:(type,props,...children)=>({type,props,children}),Label:()=>null,EffortSelect:()=>null}
 const render=vm.runInNewContext('('+code.slice(declaration.start,declaration.end)+')',sandbox)
 const tree=render({t:x=>x,state,common:{edit:(key,value)=>{changes.push([key,value]);state[key].text=value}},disabled:false,task,modelField:task+'Model'})
 let select
 function find(n){if(!n||typeof n!=='object')return;if(n.type==='select'&&n.props.id==='companion-core-'+task+'Model')select=n;for(const c of n.children??[])if(Array.isArray(c))c.forEach(find);else find(c)}find(tree)
 assert.ok(select);select.props.onChange({target:{value:'configured/vendor/model-v1'}})
 assert.deepEqual(changes,[[task+'Model','configured/vendor/model-v1']]);assert.equal(state[task+'Model'].text,'configured/vendor/model-v1');assert.equal(state[task+'Effort'].text,'low')
})
