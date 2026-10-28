#!/usr/bin/env node
// Run while dsh is stopped. Only bundle/package references change; settings IDs and data paths remain.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
const [profileArg, packageArg] = process.argv.slice(2)
if (!profileArg || !packageArg) throw new Error('Usage: node migrate-profile.mjs <profile-directory> <absolute-package.tgz>')
const profile=resolve(profileArg), archive=resolve(packageArg), file=join(profile,'package.json')
if (!existsSync(archive)) throw new Error('Package archive does not exist')
const pkg=JSON.parse(readFileSync(file,'utf8')), old=new Set(['dsh-snowluma-bridge','dsh-companion-core']), name='dsh-snowluma-companion'
if (!Array.isArray(pkg.dsh?.profile?.bundles)) throw new Error('No dsh profile bundle list; existing profile was not changed')
let added=false
pkg.dsh.profile.bundles=pkg.dsh.profile.bundles.flatMap(value=>{
 if (old.has(value)||value===name) {if(added)return [];added=true;return[name]}
 return[value]
})
if(!added)pkg.dsh.profile.bundles.push(name)
pkg.dependencies??={};for(const key of old)delete pkg.dependencies[key];pkg.dependencies[name]='file:'+archive
const replacements={'dsh-snowluma-bridge':name,'dsh-companion-core':name+'/companion','dsh-companion-core/context':name+'/context'}
const updates=[]
for(const filename of ['cordis.yml','cordis.patch.yml']) {
 const path=join(profile,filename);if(!existsSync(path))continue
 const before=readFileSync(path,'utf8')
 const after=before.replace(/(^[ \t]*(?:- )?name:[ \t]*)(['"]?)(dsh-snowluma-bridge|dsh-companion-core(?:\/context)?)\2([ \t]*(?:#.*)?)$/gm,(_,prefix,quote,module,tail)=>prefix+quote+replacements[module]+quote+tail)
 updates.push([path,after])
}
writeFileSync(file,JSON.stringify(pkg,null,2)+'\n')
for(const [path,text] of updates)writeFileSync(path,text)
console.log('Profile now references one companion package; existing settings namespaces and data paths retained.')
