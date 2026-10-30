# 依赖与公开上游清单

本清单随构建自动生成，来源为package.json、pnpm-lock.yaml、源码外部模块引用和scripts/build-update-catalog.mjs中的上游资源定义。不是对宿主已安装程序的检查。当前插件：dsh-persona-memory 2.7.1。

| 项目 | 类别 | 声明/公开快照基准（非安装证明） | 检查来源 | 用途 |
| --- | --- | --- | --- | --- |
| @deepseek-ai/cordis | host-sdk | 4.0.5 | npm: @deepseek-ai/cordis | 插件调用的宿主SDK接口，随dsh预览版本校验兼容 |
| @deepseek-ai/cosmokit | transitive-package | 1.8.6 | npm: @deepseek-ai/cosmokit | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @deepseek-ai/schemastery | host-sdk | 3.18.5 | npm: @deepseek-ai/schemastery | 插件调用的宿主SDK接口，随dsh预览版本校验兼容 |
| @standard-schema/spec | transitive-package | 1.1.0 | npm: @standard-schema/spec | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @types/node | development-package | 24.19.2 | npm: @types/node | 插件运行或构建/测试依赖；合并管理1项内部记录，详细归属见清单JSON，不逐项检查或提醒 |
| @types/nodemailer | development-package | 8.0.2 | npm: @types/nodemailer | 插件运行或构建/测试依赖 |
| @types/semver | development-package | 7.7.1 | npm: @types/semver | 插件运行或构建/测试依赖 |
| @types/ws | development-package | 8.18.2 | npm: @types/ws | 插件运行或构建/测试依赖 |
| acorn | development-package | 8.19.0 | npm: acorn | 插件运行或构建/测试依赖 |
| nodemailer | runtime-package | 10.2.1 | npm: nodemailer | 插件运行或构建/测试依赖 |
| playwright | development-package | 1.64.1 | npm: playwright | 插件运行或构建/测试依赖；合并管理1项内部记录，详细归属见清单JSON，不逐项检查或提醒 |
| semver | runtime-package | 7.8.5 | npm: semver | 插件运行或构建/测试依赖 |
| typescript | development-package | 7.0.2 | npm: typescript | 插件运行或构建/测试依赖；合并管理20项内部记录，详细归属见清单JSON，不逐项检查或提醒 |
| ws | development-package | 8.22.0 | npm: ws | 插件运行或构建/测试依赖 |
| yaml | development-package | 2.9.1 | npm: yaml | 插件运行或构建/测试依赖 |
| dsh-persona-memory正式发行 | upstream | 2.7.1 | github: Geng-zy/dsh-persona-memory | 本插件公开正式发行；不自动下载安装 |
| QQ接入插件可选联动 | upstream | 2.7.1 | github: Geng-zy/dsh-qq-gateway | 可选插件间事件与服务接口兼容；独立安装不要求另一个插件在场 |
| DeepSeek Harness | upstream | 0.2.1-rc.2 | npm: @deepseek-ai/dsh | 宿主公开发行与插件SDK兼容，允许预览版；不扫描宿主安装情况；合并管理31项内部记录，详细归属见清单JSON，不逐项检查或提醒 |
| Node.js LTS | upstream | 24.22.1 | node-lts: https://nodejs.org/dist/index.json | 插件运行/开发所需的上游最新LTS；不检测服务器安装；合并管理8项内部记录，详细归属见清单JSON，不逐项检查或提醒 |
| Jina Reader公开网页读取后备 | service | 首次公开观测建立基准，非已适配证明 | document: https://jina.ai/reader/ | 可选公开文档读取后备服务；仅发送公开来源URL，不发送凭据、配置或业务数据 |
| pnpm | upstream | 11.28.5 | npm: pnpm | 仓库安装、锁文件及发布工具 |
| GNU tar归档工具 | external-tool-reference | 首次公开观测建立基准，非已适配证明 | document: https://www.gnu.org/software/tar/ | 仅跟踪插件相关工具的公开版本/发布资料，不检查或修改宿主安装；首次观测不是已适配基准 |
| gzip压缩格式/归档工具 | external-tool-reference | 首次公开观测建立基准，非已适配证明 | document: https://www.gnu.org/software/gzip/ | 仅跟踪插件相关工具的公开版本/发布资料，不检查或修改宿主安装；首次观测不是已适配基准 |
| Python安装/开发工具 | external-tool-reference | 首次公开观测建立基准，非已适配证明 | document: https://www.python.org/downloads/ | 仅跟踪插件相关工具的公开版本/发布资料，不检查或修改宿主安装；首次观测不是已适配基准 |
| Git源码/发布工具 | external-tool-reference | 首次公开观测建立基准，非已适配证明 | document: https://git-scm.com/downloads | 仅跟踪插件相关工具的公开版本/发布资料，不检查或修改宿主安装；首次观测不是已适配基准 |
| curl下载引导工具 | external-tool-reference | 首次公开观测建立基准，非已适配证明 | document: https://curl.se/changes.html | 仅跟踪插件相关工具的公开版本/发布资料，不检查或修改宿主安装；首次观测不是已适配基准 |
| Bash脚本工具 | external-tool-reference | 首次公开观测建立基准，非已适配证明 | document: https://www.gnu.org/software/bash/ | 仅跟踪插件相关工具的公开版本/发布资料，不检查或修改宿主安装；首次观测不是已适配基准 |
| libarchive/bsdtar可选归档实现 | external-tool-reference | 首次公开观测建立基准，非已适配证明 | github: libarchive/libarchive | macOS等环境的tar实现兼容参考；不检查本机版本 |
| OpenAI兼容接口 | service | 首次公开观测建立基准，非已适配证明 | document: https://developers.openai.com/api/docs/deprecations | 记忆整理/压缩/审核/抽取/向量接口对接的公开模型与弃用资料变化；未配置项也覆盖 |
| DeepSeek模型与接口 | service | 首次公开观测建立基准，非已适配证明 | document: https://api-docs.deepseek.com/updates/ | 记忆整理/压缩/审核/抽取/向量接口对接的公开模型与弃用资料变化；未配置项也覆盖 |
| 硅基流动向量/模型服务 | service | 首次公开观测建立基准，非已适配证明 | document: https://docs.siliconflow.cn/cn/release-notes/overview | 记忆整理/压缩/审核/抽取/向量接口对接的公开模型与弃用资料变化；未配置项也覆盖 |
| 百炼模型接口 | service | 首次公开观测建立基准，非已适配证明 | document: https://help.aliyun.com/zh/model-studio/model-release-notes | 记忆整理/压缩/审核/抽取/向量接口对接的公开模型与弃用资料变化；未配置项也覆盖 |
| 智谱模型接口 | service | 首次公开观测建立基准，非已适配证明 | document: https://docs.bigmodel.cn/cn/guide/start/model-overview | 记忆整理/压缩/审核/抽取/向量接口对接的公开模型与弃用资料变化；未配置项也覆盖 |
| 火山方舟接口 | service | 首次公开观测建立基准，非已适配证明 | document: https://docs.volcengine.com/docs/ark/product-update-announcements | 记忆整理/压缩/审核/抽取/向量接口对接的公开模型与弃用资料变化；未配置项也覆盖 |
| OpenRouter | service | 首次公开观测建立基准，非已适配证明 | document: https://openrouter.ai/docs/changelog | 记忆整理/压缩/审核/抽取/向量接口对接的公开模型与弃用资料变化；未配置项也覆盖 |
| BAAI/bge-m3向量模型 | resource | 首次公开观测建立基准，非已适配证明 | github-file: FlagOpen/FlagEmbedding / README.md | 默认向量模型来源/检索框架公开说明；API提供商实际模型版本另需核实 |
| Anthropic报告API | service | 首次公开观测建立基准，非已适配证明 | document: https://platform.claude.com/docs/en/release-notes/api | 独立报告模型模板的公开接口与弃用说明 |
| 魔搭报告API | service | 首次公开观测建立基准，非已适配证明 | document: https://modelscope.cn/docs/model-service/API-Inference/intro | 独立报告模型模板的公开接口与弃用说明 |
| Mistral | related-project | 首次公开观测建立基准，非已适配证明 | document: https://docs.mistral.ai/getting-started/changelog/ | 内置聊天/向量/语音识别/通知模板相关的官方接口、模型和弃用资料；不代表用户已启用 |
| Groq | related-project | 首次公开观测建立基准，非已适配证明 | document: https://console.groq.com/docs/changelog | 内置聊天/向量/语音识别/通知模板相关的官方接口、模型和弃用资料；不代表用户已启用 |
| Kimi / Moonshot | related-project | 首次公开观测建立基准，非已适配证明 | document: https://platform.kimi.com/blog/posts/changelog | 内置聊天/向量/语音识别/通知模板相关的官方接口、模型和弃用资料；不代表用户已启用 |
| MiniMax | related-project | 首次公开观测建立基准，非已适配证明 | document: https://platform.minimax.cn/docs/release-notes/models | 内置聊天/向量/语音识别/通知模板相关的官方接口、模型和弃用资料；不代表用户已启用 |
| 腾讯混元 | related-project | 首次公开观测建立基准，非已适配证明 | document: https://cloud.tencent.com/document/product/1729/101849 | 内置聊天/向量/语音识别/通知模板相关的官方接口、模型和弃用资料；不代表用户已启用 |
| 百度千帆 | related-project | 首次公开观测建立基准，非已适配证明 | document: https://cloud.baidu.com/doc/qianfan/s/Kmh4stnjp | 内置聊天/向量/语音识别/通知模板相关的官方接口、模型和弃用资料；不代表用户已启用 |
| Jina Embeddings | related-project | 首次公开观测建立基准，非已适配证明 | document: https://jina.ai/embeddings/ | 内置聊天/向量/语音识别/通知模板相关的官方接口、模型和弃用资料；不代表用户已启用 |
| Cohere | related-project | 首次公开观测建立基准，非已适配证明 | document: https://docs.cohere.com/changelog | 内置聊天/向量/语音识别/通知模板相关的官方接口、模型和弃用资料；不代表用户已启用 |
| Gemini / Imagen | related-project | 首次公开观测建立基准，非已适配证明 | document: https://ai.google.dev/gemini-api/docs/changelog | 内置聊天/向量/语音识别/通知模板相关的官方接口、模型和弃用资料；不代表用户已启用 |
| Server酱 | related-project | 首次公开观测建立基准，非已适配证明 | document: https://sct.ftqq.com/docs/ | 内置聊天/向量/语音识别/通知模板相关的官方接口、模型和弃用资料；不代表用户已启用 |
| PushPlus | related-project | 首次公开观测建立基准，非已适配证明 | document: https://www.pushplus.plus/doc/guide/api.html | 内置聊天/向量/语音识别/通知模板相关的官方接口、模型和弃用资料；不代表用户已启用 |
| Ollama | related-project | 首次公开观测建立基准，非已适配证明 | github: ollama/ollama | 可选OpenAI兼容本地模型服务，不读取本机模型和安装版本 |
| LM Studio | related-project | 首次公开观测建立基准，非已适配证明 | document: https://lmstudio.ai/changelog | 可选本地OpenAI兼容服务的官方稳定版发布记录 |
| LobeHub服务商图标 | resource | 1.98.0 | npm: @lobehub/icons-static-svg | 静态内嵌Logo来源；核对资源署名和商标许可 |
| dsh-agent-md设计参考 | resource | 首次公开观测建立基准，非已适配证明 | github-file: wwsmiler1-bit/dsh-agent-md / README.md | 记录设计参考来源变化，不自动移植或纳入人格提示 |
| GitHub CLI | development-tool-reference | 首次公开观测建立基准，非已适配证明 | github: cli/cli | 公开发行与开发发布流程兼容；不扫描本机CLI或读取登录凭据 |

## 随上层统一管理的组件

- @types/node：1项。
- playwright：1项。
- typescript：20项。
- DeepSeek Harness：31项。
- Node.js LTS：8项。

详细映射保留在DEPENDENCIES.json的managedSources，供维护审查；内部组件不作为独立检查或通知项。更新上层会采用该上层所集成的组件版本，不保证每个组件都恰为其独立最新版。

## 覆盖边界

- 检查单位按可独立更新的上层项目合并；内部模块保留managedSources归属记录，既不逐个联网检查，也不单独提醒。软件发布、镜像发布和独立工具不是同一升级单位。
- 清单覆盖本插件锁/声明/源码/脚本/测试导入、资源和接入；QQ另含官方公开镜像声明、SnowLuma公开锁快照。均不扫描宿主，不把公开快照当实际安装证明。
- 公开资料型服务没有可靠版本API时比较正文摘要，首次只建立基线；页面改版、脚本渲染、缺少历史或访问失败均须人工核实。
- 自定义HTTP、本地命令、第三方模型/工作流/插件和用户后加的工具无法从私有配置推断；请在补充上游中登记公开来源与适配基准。报告不会读取命令或密钥。
- npm稳定版本不等于适配兼容；dsh/SDK预览版也必须做回归。间接依赖优先通过上层包升级。安全公告只覆盖OSV已收录的npm版本。
- 没有公开SBOM的闭源QQ/镜像内部、用户自定义命令/私有模型/后加插件不能凭空枚举；新项目须登记公开来源。公开上游锁与镜像声明变化时须刷新UPSTREAM-SNAPSHOT，覆盖不代表永久不漏项。
- 版本规则：明确LTS优先，无LTS采用正式稳定版；不自动回退预览。dsh/SDK是预览例外。文件/服务文档监测内容变化，不等于软件发版。
- 当前报告记录仓库发布基准，不能代表服务器实际安装；部署状态由接手者获得授权后核对。
- 邮件/微信厂商的账号额度、地域、服务端灰度和不公开变更无法保证自动识别；报告列出来源和未决项，不宣称覆盖上游未公开信息。
