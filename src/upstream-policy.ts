import semver from 'semver'
export const ltsLabel=(s:string):boolean=>/(?:^|[^a-z])lts(?:$|[^a-z])|long[ -]term support/i.test(s)
export const previewLabel=(s:string):boolean=>/(?:^|[\W_])(?:alpha|beta|preview|nightly|canary|dev|test|experimental|rc\d*)(?:$|[\W_])|\d(?:alpha|beta|rc)\d*/i.test(s)
export function releaseVersion(tag:string):string|null {
  const plain=tag.replace(/^(?:openssl-|release[-_]|n)/i,'').replace(/[-_.]lts(?:[-_.]?\d+)?$/i,'')
  return semver.valid(plain) ?? (/^v?\d+(?:\.\d+){1,2}$/.test(plain)?semver.coerce(plain)?.version??null:null)
}
export function npmLtsVersions(data:any):string[]{
 const tags=Object.entries(data['dist-tags']??{}).filter(([k])=>/^(?:lts(?:[-_].+)?|latest[-_]lts(?:[-_].+)?|v?\d+[-_]lts)$/i.test(k))
 if(!tags.length)return []
 const versions=[...new Set(tags.map(([,v])=>String(v)).filter(v=>semver.valid(v)&&!semver.prerelease(v)&&data.versions?.[v]))].sort(semver.rcompare)
 if(!versions.length)throw Error('LTS标签没有可确认的正式版本；不回退到普通最新版')
 return versions
}
export function ltsCycles(data:any,now:number,product:string=''):any[]{
 const rows=data?.result?.releases
 if(!Array.isArray(rows))throw Error('LTS生命周期数据格式无效')
 const valid=rows.filter(x=>(product==='debian'?x.isEoas===true&&Date.parse(x.eoasFrom)<=now:x.isLts===true)&&x.isEol===false&&(!x.eolFrom||Date.parse(x.eolFrom)>now)&&/^\d+(?:\.\d+)*$/.test(x.name)&&Date.parse(x.releaseDate)<=now)
 const compare=(a:any,b:any):number=>{const aa=a.name.split('.').map(Number),bb=b.name.split('.').map(Number);for(let i=0;i<Math.max(aa.length,bb.length);i++){const d=(bb[i]??0)-(aa[i]??0);if(d)return d}return 0}
 valid.sort(compare)
 if(!valid.length)throw Error('未能确认受支持的已发布LTS；不回退普通版或预览版')
 return valid
}
export const inCycle=(v:string,cycle:string):boolean=>{const version=releaseVersion(v);return !!version&&(version===cycle||version.startsWith(cycle+'.'))}
