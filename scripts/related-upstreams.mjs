import{readFileSync}from'node:fs'
export function addRelatedSources(sources,{root,qq}){
 const add=(id,name,kind,target,purpose,files=[],more={})=>{if(!sources.some(x=>x.id===id))sources.push({id,name,kind,target,purpose,files,category:'related-project',...more})}
 const doc=(id,name,url,purpose,files)=>add(id,name,'document',url,purpose,files)
 const repo=(id,name,target,purpose,files=[],more={})=>add(id,name,'github',target,purpose,files,more)
 const file=(id,name,target,path,purpose,files=[])=>add(id,name,'github-file',target,purpose,files,{path,category:'resource'})
 const services=[
 ['mistral','Mistral','https://docs.mistral.ai/getting-started/changelog/'],['groq','Groq','https://console.groq.com/docs/changelog'],
 ['glm','智谱','https://docs.bigmodel.cn/cn/guide/start/model-overview'],['moonshot','Kimi / Moonshot','https://platform.kimi.com/blog/posts/changelog'],
 ['minimax','MiniMax','https://platform.minimax.cn/docs/release-notes/models'],['hunyuan','腾讯混元','https://cloud.tencent.com/document/product/1729/101849'],
 ['qianfan','百度千帆','https://cloud.baidu.com/doc/qianfan/s/Kmh4stnjp'],['jina-embed','Jina Embeddings','https://jina.ai/embeddings/'],
 ['cohere','Cohere','https://docs.cohere.com/changelog'],['gemini','Gemini / Imagen','https://ai.google.dev/gemini-api/docs/changelog'],
 ['serverchan','Server酱','https://sct.ftqq.com/docs/'],['pushplus','PushPlus','https://www.pushplus.plus/doc/guide/api.html']]
 for(const[id,name,url]of services)if(!qq||['mistral','groq','glm'].includes(id))doc('service:'+id,name,url,'内置聊天/向量/语音识别/通知模板相关的官方接口、模型和弃用资料；不代表用户已启用',[qq?'src/client/bridge.js':'src/client/companion.js'])
 for(const[id,name,target]of [['ollama','Ollama','ollama/ollama'],['lmstudio','LM Studio','lmstudio-ai/lmstudio-bug-tracker']]){
  if(id==='lmstudio')doc(id,name,'https://lmstudio.ai/changelog','可选本地OpenAI兼容服务的官方稳定版发布记录',['src/client/'+(qq?'bridge.js':'companion.js')])
  else repo(id,name,target,'可选OpenAI兼容本地模型服务，不读取本机模型和安装版本',['src/models.ts'])
 }
 add('icons','LobeHub服务商图标','npm','@lobehub/icons-static-svg','静态内嵌Logo来源；核对资源署名和商标许可',['NOTICE.md','src/client/layout.js'],{current:'1.98.0',category:'resource'})
 file('design-reference','dsh-agent-md设计参考','wwsmiler1-bit/dsh-agent-md','README.md','记录设计参考来源变化，不自动移植或纳入人格提示',['NOTICE.md'])
 repo('gh-cli','GitHub CLI','cli/cli','公开发行与开发发布流程兼容；不扫描本机CLI或读取登录凭据',['README.md'],{category:'development-tool-reference'})
 file('node-bundled','Node内置依赖目录','nodejs/node','deps','Node绑定的V8、OpenSSL、SQLite、libuv、zlib/zstd、ICU、网络/压缩库等依赖变化；随Node集成更新，不单独替换',['package.json'])
 repo('openssl','OpenSSL LTS','openssl/openssl','Node/HTTPS及外部工具的间接TLS依赖；只比较受支持最新LTS，不单独替换Node内置库',['src/updates.ts'],{ltsProduct:'openssl'})
 doc('openssl-policy','OpenSSL支持政策','https://www.openssl-library.org/policies/releasestrat/','LTS通道政策的官方证据，仅元数据参考',['src/updates.ts'])
 for(const[name,url]of [['zstd','https://github.com/facebook/zstd/releases'],['ICU','https://icu.unicode.org/download'],['libuv','https://github.com/libuv/libuv/releases']])doc('node-ref:'+name,name+'（Node绑定）',url,'Node内置库的公开发行参考，不作为独立可升级组件',['package.json'])
 for(const product of (qq?['openssl','containerd','ffmpeg','ubuntu','debian']:['openssl']))file('lts-metadata:'+product,product+'生命周期数据来源','endoflife-date/endoflife.date','products/'+product+'.md','版本筛选新增依赖的社区生命周期元数据本身；支持政策仍需核对官方证据',['src/upstream-policy.ts'])
 if(!qq)return
 const refs=['deploy/install.py','deploy/snowluma.compose.yml']
 const installer=readFileSync(new URL('deploy/install.py',root),'utf8')
 const installed=[...installer.matchAll(/run\(\['apt-get', 'install', '-y', ([^\]]+)\]/g)].flatMap(m=>[...m[1].matchAll(/'([a-z0-9+.-]+)'/g)].map(x=>x[1]))
 for(const binary of new Set(installed))doc('deployment-package:'+binary,binary+'（安装器声明包）','https://packages.ubuntu.com/resolute/'+binary,'安装器显式软件包的受支持Ubuntu LTS发行参考；实际可用版本以对应发行源为准，不等同宿主巡检',refs)
 file('test-browsers','Playwright绑定浏览器清单','microsoft/playwright','packages/playwright-core/browsers.json','测试浏览器Chromium/Firefox/WebKit及下载资源随Playwright版本集成，不单独替换',['package.json','test/ui.mjs'])
 for(const[id,name,target,more]of [
  ['docker-engine','Docker Engine','moby/moby',{}],['docker-cli','Docker CLI','docker/cli',{}],['docker-compose','Docker Compose','docker/compose',{}],
  ['docker-buildx','Docker Buildx','docker/buildx',{}],['docker-buildkit','BuildKit','moby/buildkit',{}],['containerd','containerd LTS','containerd/containerd',{ltsProduct:'containerd'}],['runc','runc','opencontainers/runc',{}],
  ['novnc','noVNC','novnc/noVNC',{}],['websockify','websockify','novnc/websockify',{}],['supervisor','Supervisor','Supervisor/supervisor',{}],
  ['aria2','aria2','aria2/aria2',{}],['systemd','systemd','systemd/systemd',{}],['xz','XZ Utils','tukaani-project/xz',{}],['pkgconf','pkgconf','pkgconf/pkgconf',{}]
 ])repo(id,name,target,'安装器或官方镜像声明的运行/构建组件，只查公开上游，不检查、安装或升级宿主软件',refs,more)
 doc('containerd-policy','containerd支持政策','https://api.github.com/repos/containerd/containerd/contents/RELEASES.md','官方LTS支持周期证据',refs)
 add('ubuntu-lts','Ubuntu LTS','lifecycle','ubuntu','安装器支持系统的上游最新受支持LTS，不扫描或升级服务器',refs,{ltsProduct:'ubuntu'})
 add('debian-lts','Debian LTS','lifecycle','debian','官方镜像基础系统的LTS周期参考，不自动更换镜像发行系列',refs,{ltsProduct:'debian'})
 doc('ubuntu-support','Ubuntu官方发布周期','https://ubuntu.com/about/release-cycle','核对LTS周期和安装器兼容矩阵',refs)
 doc('debian-support','Debian官方LTS','https://www.debian.org/lts/','核对镜像基础发行系列支持状态',refs)
 doc('linuxqq','Linux QQ官方发布','https://im.qq.com/linuxqq/index.shtml','独立监测QQ公开发布资料；闭源内部依赖不臆造，镜像版本另由官方Dockerfile跟踪',['docs/SNOWLUMA.md'])
 file('snowluma-start','SnowLuma官方启动脚本','SnowLuma/SnowLuma.Docker.Framework','start.sh','跟踪QQ启动/桌面会话与参数变化',refs)
 file('snowluma-supervisor','SnowLuma进程定义','SnowLuma/SnowLuma.Docker.Framework','supervisord.conf','跟踪远程桌面进程组合与启动约定',refs)
 file('snowluma-compose','SnowLuma官方Compose模板','SnowLuma/SnowLuma.Docker.Framework','docker-compose.yml','官方容器默认值/卷/端口/镜像声明',refs)
 file('snowluma-lock','SnowLuma公开依赖锁','SnowLuma/SnowLuma','pnpm-lock.yaml','发现上游增删依赖；接手者须运行refresh-upstream-inventory并重新生成清单',refs)
 const snapshot=JSON.parse(readFileSync(new URL('docs/UPSTREAM-SNAPSHOT.json',root),'utf8'))
 for(const p of snapshot.snowlumaLock.packages)add('snowluma-npm:'+p.name+'@'+p.version,p.name+'（SnowLuma公开锁）','npm',p.name,'公开上游锁文件的构建/运行直接或间接依赖；此版本仅是公开快照参考，不代表当前镜像内实际版本或插件已适配',['docs/UPSTREAM-SNAPSHOT.json'],{current:p.version,category:'upstream-transitive-package',baselineKind:'upstream-snapshot'})
 for(const binary of snapshot.dockerfile.aptPackages)doc('image-package:'+binary,binary+'（官方镜像系统包）','https://packages.debian.org/'+snapshot.dockerfile.suite+'/'+binary,'官方Dockerfile显式安装的发行包，监测所声明发行系列的维护变化；不能仅凭页面变更声称有新的独立正式版',refs)
 for(const[id,name,url]of [
  ['openssh','OpenSSH','https://www.openssh.com/releasenotes.html'],['sudo','sudo','https://www.sudo.ws/releases/stable/'],['apt','APT','https://tracker.debian.org/pkg/apt'],['dpkg','dpkg','https://www.dpkg.org/'],
  ['gcc','GCC','https://gcc.gnu.org/releases.html'],['make','GNU Make','https://www.gnu.org/software/make/'],['coreutils','GNU coreutils','https://www.gnu.org/software/coreutils/'],
  ['findutils','GNU findutils','https://www.gnu.org/software/findutils/'],['grep','GNU grep','https://www.gnu.org/software/grep/'],['sed','GNU sed','https://www.gnu.org/software/sed/'],['awk','GNU awk','https://www.gnu.org/software/gawk/'],
  ['iproute2','iproute2','https://wiki.linuxfoundation.org/networking/iproute2'],['util-linux','util-linux','https://github.com/util-linux/util-linux/releases'],['ca-certificates','CA信任根','https://curl.se/docs/caextract.html']
 ])doc('deployment-tool:'+id,name,url,'安装/校验/运维脚本所需工具或发行包的公开参考，不是宿主软件巡检',refs)
 file('build-image-deps','Docker官方Node镜像定义','nodejs/docker-node','Dockerfile-slim.template','镜像构建基础与Node/Debian安全维护变化',refs)
}
