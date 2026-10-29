import {readFileSync,writeFileSync,readdirSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {parse} from 'yaml'
import {externalImports,staticProviderIds} from './import-inventory.mjs'
import {addRelatedSources} from './related-upstreams.mjs'
const root=new URL('../',import.meta.url),pkg=JSON.parse(readFileSync(new URL('package.json',root))),lockText=readFileSync(new URL('pnpm-lock.yaml',root),'utf8'),lock=parse(lockText),qq=pkg.name==='dsh-qq-gateway';
const direct={...pkg.dependencies,...pkg.devDependencies,...pkg.peerDependencies},sources=[];
for(const key of Object.keys(lock.packages||{})){
 const match=/^(.+)@(\d[^()]*)/.exec(key);if(!match)continue;
 const [,name,current]=match,declared=direct[name],category=pkg.dependencies?.[name]?'runtime-package':pkg.peerDependencies?.[name]?'host-sdk':pkg.devDependencies?.[name]?'development-package':'transitive-package';
 const id='npm:'+name+'@'+current;if(sources.some(s=>s.id===id))continue;
 sources.push({id,name,kind:'npm',target:name,current,range:declared,category,prerelease:name.startsWith('@deepseek-ai/dsh'),purpose:category==='transitive-package'?'锁文件间接依赖，核对引入它的上层包后再更新':category==='host-sdk'?'插件调用的宿主SDK接口，随dsh预览版本校验兼容':'插件运行或构建/测试依赖',files:['package.json','pnpm-lock.yaml']});
}
const source=(id,name,kind,target,current,purpose,files=[],extra={})=>sources.push({id,name,kind,target,current,purpose,files,category:'upstream',...extra});
const imported=new Map();
function scan(dir){for(const ent of readdirSync(new URL(dir,root),{withFileTypes:true})){const path=dir+ent.name;if(ent.isDirectory())scan(path+'/');else if(/\.(ts|js|mjs)$/.test(path)){const text=readFileSync(new URL(path,root),'utf8');for(const name of externalImports(text)){if(name.startsWith('.')||name.startsWith('node:')||name==='__UPDATES_PACKAGE__'||name===pkg.name||name.startsWith('dsh-qq-gateway')||name.startsWith('dsh-persona-memory')||name.startsWith('dsh-snowluma'))continue;const files=imported.get(name)||[];if(!files.includes(path))files.push(path);imported.set(name,files)}}}}
scan('src/');scan('scripts/');scan('test/');
for(const [name,files]of imported){if(sources.some(x=>x.kind==='npm'&&x.target===name))continue;source('import:'+name,name,'npm',name,name.startsWith('@deepseek-ai/dsh')?'0.2.1-rc.2':undefined,'源码引用的宿主提供模块；未随本插件锁定的版本仅按公开发行观测，实际兼容需随dsh核对',files,{prerelease:name.startsWith('@deepseek-ai/dsh'),category:'host-provided-module'})}

source('plugin-release',pkg.name+'正式发行','github','Geng-zy/'+pkg.name,pkg.version,'本插件公开正式发行；不自动下载安装',['README.md']);
source('optional-peer',qq?'人格记忆插件可选联动':'QQ接入插件可选联动','github','Geng-zy/'+(qq?'dsh-persona-memory':'dsh-qq-gateway'),pkg.version,'可选插件间事件与服务接口兼容；独立安装不要求另一个插件在场',['docs/SPLIT-MIGRATION.md']);
source('dsh','DeepSeek Harness','npm','@deepseek-ai/dsh','0.2.1-rc.2','宿主公开发行与插件SDK兼容，允许预览版；不扫描宿主安装情况',['package.json','cordis.patch.yml'],{prerelease:true});
source('node-lts','Node.js LTS','node-lts','https://nodejs.org/dist/index.json','24.22.1','插件运行/开发所需的上游最新LTS；不检测服务器安装',['package.json','scripts/setup-test-env.sh']);
source('reader','Jina Reader公开网页读取后备','document','https://jina.ai/reader/',undefined,'可选公开文档读取后备服务；仅发送公开来源URL，不发送凭据、配置或业务数据',['src/updates.ts'],{category:'service'});
source('pnpm','pnpm','npm','pnpm','11.28.5','仓库安装、锁文件及发布工具',['pnpm-lock.yaml','scripts/check.sh']);
for(const [id,name,url,files] of [
 ['tar','GNU tar归档工具','https://www.gnu.org/software/tar/',qq?['src/qq/backup.ts']:['src/companion/backup.ts']],
 ['gzip','gzip压缩格式/归档工具','https://www.gnu.org/software/gzip/',qq?['src/qq/backup.ts']:['src/companion/backup.ts']],
 ['sqlite','SQLite（随Node提供）','https://www.sqlite.org/changes.html',qq?['src/qq/archive.ts']:['src/companion/archive.ts']],
 ['python','Python安装/开发工具','https://www.python.org/downloads/',qq?['deploy/install.py','test/installer']:['package.json']],
 ['git','Git源码/发布工具','https://git-scm.com/downloads',['README.md']],
 ['curl','curl下载引导工具','https://curl.se/changes.html',qq?['install.sh','scripts/setup-test-env.sh']:['README.md']],
 ['bash','Bash脚本工具','https://www.gnu.org/software/bash/',qq?['install.sh','scripts/check.sh']:['package.json']]
])source('tool:'+id,name,'document',url,undefined,'仅跟踪插件相关工具的公开版本/发布资料，不检查或修改宿主安装；首次观测不是已适配基准',files,{category:'external-tool-reference'});
source('libarchive','libarchive/bsdtar可选归档实现','github','libarchive/libarchive',undefined,'macOS等环境的tar实现兼容参考；不检查本机版本',qq?['src/qq/backup.ts']:['src/companion/backup.ts'],{category:'external-tool-reference'});
if(qq){
 source('snowluma','SnowLuma','github','SnowLuma/SnowLuma','v2.2.1','QQ/OneBot上游正式发行与事件/API兼容',['src/adapter.ts','src/onebot','docs/SNOWLUMA.md']);
 source('astrbot','AstrBot移植来源','github','AstrBotDevs/AstrBot','v4.29.1','移植消息转换、唤醒、引用和响应规则；逐文件比较，不整包替换',['NOTICE.md','src/adapter.ts','src/components.ts','src/bridge.ts','src/quoted.ts']);
 source('aiocqhttp','aiocqhttp移植来源','pypi','aiocqhttp','1.4.4','OneBot反向WS、事件总线与API结果匹配的移植来源',['NOTICE.md','src/onebot']);
 source('qface','QQ小黄脸编号/名称','github-file','koishijs/QFace','20ab855','QFace数字表情数据，不含图片；更新后复核旧编号兼容和MIT署名',['src/qface.ts','scripts/update-qface.mjs','NOTICE.md'],{path:'public/assets/qq_emoji/_index.v2.json',category:'resource'});
 source('serverchan-sdk','Server酱官方SDK/协议说明','github-file','easychen/serverchan-sdk',undefined,'官方SMTP之外的微信推送协议、SendKey格式及接口路径变化，不作为运行SDK安装',['src/alert.ts'],{path:'README.md'});
 source('qface-legacy','QFace旧版数据包','npm','qface','1.4.1','旧表情编号补全来源；上游新版需要审查数据格式，不自动替换',['src/qface.ts','scripts/update-qface.mjs']);
 source('snowluma-framework','SnowLuma镜像构建/QQ版本定义','github-file','SnowLuma/SnowLuma.Docker.Framework',undefined,'跟踪官方镜像构建、Linux QQ版本和内置远程桌面组件变化；不扫描Docker或服务器',['deploy/snowluma.compose.yml','docs/SNOWLUMA.md'],{path:'Dockerfile'});
 source('ffmpeg','FFmpeg正式发行','ffmpeg-release','https://ffmpeg.org/download.html','9.0.0','视频抽帧和插件可选下载器所用媒体工具；只查上游不运行本机命令',['src/ffmpeg.ts','src/media.ts']);
 source('ffmpeg-builds','FFmpeg预编译构建说明','document','https://github.com/BtbN/FFmpeg-Builds',undefined,'正式分支下载资产、平台命名及校验规则；资料变化需核实，不能把滚动构建当稳定发版',['src/ffmpeg.ts']);
 const docs=[
 ['deepseek','DeepSeek对话模型/接口','https://api-docs.deepseek.com/updates/','src/bridge.ts'],
 ['onebot','OneBot 11协议','https://raw.githubusercontent.com/botuniverse/onebot-11/master/README.md','src/onebot'],
 ['breeze','BreezeBlue TTS','https://docs.breezeblue.ai/','src/tts.ts'],['inworld','Inworld TTS','https://docs.inworld.ai/docs/tts/tts','src/tts.ts'],
 ['openai','OpenAI接口/生图/语音识别','https://developers.openai.com/api/docs/deprecations','src/image-generation.ts'],
 ['azure','Azure OpenAI接口','https://learn.microsoft.com/en-us/azure/ai-services/openai/api-version-deprecation','src/image-generation.ts'],
 ['modelscope','魔搭推理服务','https://modelscope.cn/docs/model-service/API-Inference/intro','src/image-generation.ts'],
 ['dashscope','百炼图像服务','https://help.aliyun.com/zh/model-studio/text-to-image','src/image-generation.ts'],
 ['gemini','Gemini/Imagen API','https://ai.google.dev/gemini-api/docs/changelog','src/image-generation.ts'],
 ['vertex','Vertex AI图像服务','https://cloud.google.com/vertex-ai/generative-ai/docs/release-notes','src/image-generation.ts'],
 ['openrouter','OpenRouter','https://openrouter.ai/docs/changelog','src/image-generation.ts'],
 ['bfl','Black Forest Labs','https://docs.bfl.ai','src/image-generation.ts'],['fal','fal.ai','https://docs.fal.ai','src/image-generation.ts'],
 ['replicate','Replicate','https://replicate.com/changelog','src/image-generation.ts'],['stability','Stability AI','https://platform.stability.ai/docs/release-notes','src/image-generation.ts'],
 ['ideogram','Ideogram','https://developer.ideogram.ai','src/image-generation.ts'],['huggingface','Hugging Face推理','https://huggingface.co/docs/inference-providers/index','src/image-generation.ts'],
 ['serverchan','Server酱','https://sct.ftqq.com','src/alert.ts'],['pushplus','PushPlus','https://www.pushplus.plus/doc/guide/api.html','src/alert.ts'],
 ];
 for(const [id,name,url,file]of docs)source('service:'+id,name,'document',url,undefined,'官方接口/模型发布与弃用资料变化；全量监测支持项，不代表已配置或实际启用',[file],{category:'service'});
 for(const [id,name,repo,file] of [['a1111','AUTOMATIC1111','AUTOMATIC1111/stable-diffusion-webui','src/image-generation.ts'],['forge','Forge','lllyasviel/stable-diffusion-webui-forge','src/image-generation.ts'],['comfyui','ComfyUI','Comfy-Org/ComfyUI','src/image-generation.ts'],['diffusers','Diffusers本地命令接入','huggingface/diffusers','src/image-generation.ts']])source(id,name,'github',repo,undefined,'可选接入上游，首次仅发现正式版本，基准需按适配实际补充；不探测本机程序',[file]);
}else{
 for(const [id,name,url] of [['openai','OpenAI兼容接口','https://developers.openai.com/api/docs/deprecations'],['deepseek','DeepSeek模型与接口','https://api-docs.deepseek.com/updates/'],['siliconflow','硅基流动向量/模型服务','https://docs.siliconflow.cn/cn/release-notes/overview'],['dashscope','百炼模型接口','https://help.aliyun.com/zh/model-studio/developer-reference/api-details'],['glm','智谱模型接口','https://docs.bigmodel.cn/cn/guide/start/model-overview'],['volcengine','火山方舟接口','https://www.volcengine.com/docs/82379'],['openrouter','OpenRouter','https://openrouter.ai/docs/changelog']])source('service:'+id,name,'document',url,undefined,'记忆整理/压缩/审核/抽取/向量接口对接的公开模型与弃用资料变化；未配置项也覆盖',['src/companion/chat.ts','src/companion/embed.ts','src/companion/extract.ts'],{category:'service'});
 source('bge-m3','BAAI/bge-m3向量模型','github-file','FlagOpen/FlagEmbedding',undefined,'默认向量模型来源/检索框架公开说明；API提供商实际模型版本另需核实',['src/companion/embed.ts'],{path:'README.md',category:'resource'});
}
for(const [id,name,url]of [['anthropic','Anthropic报告API','https://platform.claude.com/docs/en/release-notes/api'],['deepseek','DeepSeek报告API','https://api-docs.deepseek.com/updates/'],['modelscope','魔搭报告API','https://modelscope.cn/docs/model-service/API-Inference/intro'],['siliconflow','硅基流动报告API','https://docs.siliconflow.cn/cn/release-notes/overview']]){if(!sources.some(x=>x.id==='service:'+id))source('service:'+id,name,'document',url,undefined,'独立报告模型模板的公开接口与弃用说明',['src/update-model.ts','src/client/updates.js'],{category:'service'})}
addRelatedSources(sources,{root,qq});
for(const name of Object.keys(direct)){if(!sources.some(s=>s.kind==='npm'&&s.target===name))source('declared:'+name,name,'npm',name,undefined,'声明但未由锁文件固定的依赖，首次公开观测不代表已适配',['package.json'],{prerelease:name.startsWith('@deepseek-ai/dsh')})}
for(const name of ['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app'])if(!sources.some(s=>s.target===name))source('host:'+name,name,'npm',name,'0.2.1-rc.2','宿主基础bundle与预设/UI接口，保留预览例外',['cordis.patch.yml'],{prerelease:true});
if(sources.some(s=>s.kind==='npm'&&!/^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+$/i.test(s.target)))throw Error('Invalid npm inventory entry');
const providerAliases={bailian:'service:dashscope',zhipu:'service:glm',jina:'service:jina-embed',ollama:'ollama',lmstudio:'lmstudio',imagen:'service:gemini',a1111:'a1111',comfyui:'comfyui'};
for(const file of ['src/client/'+(qq?'bridge.js':'companion.js'),'src/client/updates.js'])for(const id of staticProviderIds(readFileSync(new URL(file,root),'utf8'))){if(id==='custom'||id==='command')continue;const key=providerAliases[id]??'service:'+id;if(!sources.some(s=>s.id===key))throw Error('Missing provider upstream: '+id+' in '+file)}
const catalog={owner:pkg.name,version:pkg.version,repository:pkg.repository.url.replace('git+','').replace(/\.git$/,''),lockHash:createHash('sha256').update(lockText).digest('hex'),sources,limitations:[
 '清单覆盖本插件锁/声明/源码/脚本/测试导入、资源和接入；QQ另含官方公开镜像声明、SnowLuma公开锁快照。均不扫描宿主，不把公开快照当实际安装证明。',
 '公开资料型服务没有可靠版本API时比较正文摘要，首次只建立基线；页面改版、脚本渲染、缺少历史或访问失败均须人工核实。',
 '自定义HTTP、本地命令、第三方模型/工作流/插件和用户后加的工具无法从私有配置推断；请在补充上游中登记公开来源与适配基准。报告不会读取命令或密钥。',
 'npm稳定版本不等于适配兼容；dsh/SDK预览版也必须做回归。间接依赖优先通过上层包升级。安全公告只覆盖OSV已收录的npm版本。',
 '没有公开SBOM的闭源QQ/镜像内部、用户自定义命令/私有模型/后加插件不能凭空枚举；新项目须登记公开来源。公开上游锁与镜像声明变化时须刷新UPSTREAM-SNAPSHOT，覆盖不代表永久不漏项。',
 '版本规则：明确LTS优先，无LTS采用正式稳定版；不自动回退预览。dsh/SDK是预览例外。文件/服务文档监测内容变化，不等于软件发版。',
 '当前报告记录仓库发布基准，不能代表服务器实际安装；部署状态由接手者获得授权后核对。',
 '邮件/微信厂商的账号额度、地域、服务端灰度和不公开变更无法保证自动识别；报告列出来源和未决项，不宣称覆盖上游未公开信息。'
]};
writeFileSync(new URL('src/update-catalog.ts',root),'// Generated from package.json, pnpm-lock.yaml and public upstream inventory; no local environment.\nimport type {Catalog} from "./updates.js"\nexport const updateCatalog: Catalog = '+JSON.stringify(catalog,null,2)+'\n');

writeFileSync(new URL('docs/DEPENDENCIES.json',root),JSON.stringify(catalog,null,2)+'\n');
writeFileSync(new URL('docs/DEPENDENCIES.md',root),'# 依赖与公开上游清单\n\n本清单随构建自动生成，来源为package.json、pnpm-lock.yaml、源码外部模块引用和scripts/build-update-catalog.mjs中的上游资源定义。不是对宿主已安装程序的检查。当前插件：'+catalog.owner+' '+catalog.version+'。\n\n| 项目 | 类别 | 声明/公开快照基准（非安装证明） | 检查来源 | 用途 |\n| --- | --- | --- | --- | --- |\n'+sources.map(s=>'| '+s.name+' | '+s.category+' | '+(s.current||'首次公开观测建立基准，非已适配证明')+' | '+s.kind+': '+s.target+(s.path?' / '+s.path:'')+' | '+s.purpose+' |').join('\n')+'\n\n## 覆盖边界\n\n'+catalog.limitations.map(s=>'- '+s).join('\n')+'\n');
