// Keep the ownership inventory, but only check independently maintained upgrade units.
export function groupUpstreams(all){
 const managedSources=[],sources=[],byId=new Map(all.map(s=>[s.id,s]));
 const npmId=name=>all.find(s=>s.kind==='npm'&&s.target===name&&!s.id.startsWith('snowluma-npm:'))?.id
 const imageIds=new Set(['snowluma-framework','snowluma-start','snowluma-supervisor','snowluma-compose','build-image-deps','debian-lts','debian-support','lts-metadata:debian','novnc','websockify','supervisor','aria2','linuxqq'])
 const nodeIds=new Set(['node-bundled','openssl','openssl-policy','lts-metadata:openssl','tool:sqlite','node-ref:zstd','node-ref:ICU','node-ref:libuv'])
 for(const s of all){
  let managedBy,managedReason
  if(s.id.startsWith('snowluma-npm:')||s.id==='snowluma-lock'){managedBy='snowluma';managedReason='SnowLuma应用内部依赖，由上游应用版本统一集成与更新'}
  else if((s.id!=='dsh'&&s.kind==='npm'&&s.target.startsWith('@deepseek-ai/dsh')&&s.current===byId.get('dsh')?.current)||s.category==='host-provided-module'){managedBy='dsh';managedReason='随dsh宿主版本交付的内部插件、SDK或UI模块'}
  else if(nodeIds.has(s.id)){managedBy='node-lts';managedReason='当前接入使用Node绑定的库，随Node集成更新，不单独替换'}
  else if(s.id.startsWith('image-package:')||imageIds.has(s.id)){managedBy='snowluma-image';managedReason='官方镜像交付的QQ/桌面/系统组件或构建定义，跟踪镜像内容统一更新'}
  else if(s.kind==='npm'&&s.target.startsWith('@typescript/typescript-')){managedBy=npmId('typescript');managedReason='TypeScript同版本平台编译器二进制'}
  else if(s.id==='test-browsers'||s.kind==='npm'&&s.target==='playwright-core'){managedBy=npmId('playwright');managedReason='Playwright同版本核心与绑定浏览器，更新Playwright后执行浏览器安装'}
  else if(s.kind==='npm'&&s.target==='undici-types'){managedBy=npmId('@types/node');managedReason='Node类型包配套声明，随上层类型依赖统一维护'}
  else if(s.category==='transitive-package'&&s.target==='zod'){managedBy='dsh';managedReason='本项目未直接使用，由宿主SDK引入并管理的间接依赖'}
  if(managedBy){if(!byId.has(managedBy))throw Error('Missing upgrade owner '+managedBy+' for '+s.id);managedSources.push({...s,managedBy,managedReason})}
  else sources.push({...s})
 }
 for(const parent of sources){const children=managedSources.filter(s=>s.managedBy===parent.id);if(children.length){parent.managedCount=children.length;parent.purpose+='；合并管理'+children.length+'项内部记录，详细归属见清单JSON，不逐项检查或提醒'}}
 return{sources,managedSources}
}
