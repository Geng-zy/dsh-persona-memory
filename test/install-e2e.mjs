// Boot a clean profile from an actual packed release, using the installer's generated configuration.
import assert from 'node:assert/strict'
import { mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn,execFileSync } from 'node:child_process'
import { createServer } from 'node:net'
const root=fileURLToPath(new URL('../',import.meta.url)), temp=mkdtempSync(join(tmpdir(),'dsh-install-e2e-'))
const freePort=async()=>{const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const p=server.address().port;await new Promise(r=>server.close(r));return p}
const webPort=await freePort(), wsPort=await freePort(), home=join(temp,'home'), profile=join(home,'profiles/web'), workspace=join(home,'workspace')
let child, logs=''
try {
 const archive=join(temp,'plugin.tgz')
 execFileSync('npx',['--offline','--yes','pnpm@11.28.5','pack','--out',archive],{cwd:root,stdio:'pipe'})
 mkdirSync(profile,{recursive:true});mkdirSync(workspace)
 writeFileSync(join(profile,'package.json'),JSON.stringify({name:'installer-profile',private:true,dsh:{profile:{bundles:['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app','dsh-snowluma-companion']}},dependencies:{'dsh-snowluma-companion':'file:'+archive}}))
 writeFileSync(join(profile,'pnpm-workspace.yaml'),'packages:\n  - .\nnodeLinker: hoisted\nautoInstallPeers: false\n')
 const generated=execFileSync('python3',['-c',`import sys,json;sys.path.insert(0,'test/installer');from test_install import config,installer;c=config();c['bridge_port']=int(sys.argv[1]);print(json.dumps(installer.profile_patch(c,sys.argv[2])))`,String(wsPort),workspace],{cwd:root,encoding:'utf8'})
 writeFileSync(join(profile,'cordis.patch.yml'),generated)
 execFileSync('npx',['--offline','--yes','pnpm@11.28.5','install','--offline','--ignore-scripts'],{cwd:profile,stdio:'pipe'})
 child=spawn(process.env.DSH_BIN??join(root,'.cache/test-env/dsh/node_modules/.bin/dsh'),['web','--host','127.0.0.1','--port',String(webPort),'--public-url',`http://example.test:${webPort}/`,'--trusted-host',`example.test:${webPort}`,'--no-open'],{cwd:workspace,env:{...process.env,DSH_HOME:home,DSH_TELEMETRY_DISABLED:'1',DEEPSEEK_API_KEY:'fake-install-api-key'},stdio:['ignore','pipe','pipe']})
 for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{logs+=b})
 const end=Date.now()+90000
 while(!/dsh web: http/.test(logs)&&Date.now()<end&&child.exitCode===null)await new Promise(r=>setTimeout(r,200))
 const url=logs.match(/dsh web: (http:\/\/[^\s]+\?token=[A-Za-z0-9_-]+)/)?.[1]
 assert.ok(url,'fresh installed profile must boot: '+logs.slice(-2500))
 const physical=`http://127.0.0.1:${webPort}/`,headers={host:`example.test:${webPort}`}
 const login=await fetch(physical+new URL(url).search,{headers,redirect:'manual'})
 assert.ok([302,303].includes(login.status))
 headers.cookie=login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')
 const get=async p=>{const r=await fetch(physical+'api/'+p,{headers});assert.equal(r.status,200,p);return r.json()}
 // The web login URL can be ready before the reverse-WS server finishes binding.
 let bridge=await get('snowluma-bridge/status')
 const listeningDeadline=Date.now()+10000
 while(!bridge.listening&&Date.now()<listeningDeadline){await new Promise(r=>setTimeout(r,100));bridge=await get('snowluma-bridge/status')}
 const core=await get('companion/state'),models=await get('snowluma-bridge/llm/dsh-models')
 assert.equal(bridge.listening,true,'reverse WS must become ready: '+JSON.stringify(bridge));assert.ok(core.archive);assert.equal(core.snowluma,true);assert.equal(core.backupItemsAll.length,9)
 assert.equal(models.default.provider,'deepseek-official');assert.equal(models.default.model,'deepseek-flash')
 console.log('[install-e2e] Packed fresh profile, official peer resolution, custom model configuration, public Host/Origin trust, login and plugin/database endpoints passed')
} finally {
 if(child&&child.exitCode===null){child.kill('SIGTERM');await new Promise(r=>{child.once('exit',r);setTimeout(r,8000)})}
 rmSync(temp,{recursive:true,force:true})
}
