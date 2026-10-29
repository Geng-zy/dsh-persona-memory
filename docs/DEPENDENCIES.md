# 依赖与公开上游清单

本清单随构建自动生成，来源为package.json、pnpm-lock.yaml、源码外部模块引用和scripts/build-update-catalog.mjs中的上游资源定义。不是对宿主已安装程序的检查。当前插件：dsh-persona-memory 2.4.2。

| 项目 | 类别 | 仓库适配基准 | 检查来源 | 用途 |
| --- | --- | --- | --- | --- |
| @deepseek-ai/cordis | host-sdk | 4.0.5 | npm: @deepseek-ai/cordis | 插件调用的宿主SDK接口，随dsh预览版本校验兼容 |
| @deepseek-ai/cosmokit | transitive-package | 1.8.6 | npm: @deepseek-ai/cosmokit | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @deepseek-ai/dsh-agent | host-sdk | 0.2.1-rc.2 | npm: @deepseek-ai/dsh-agent | 插件调用的宿主SDK接口，随dsh预览版本校验兼容 |
| @deepseek-ai/dsh-attachment | transitive-package | 0.2.1-rc.2 | npm: @deepseek-ai/dsh-attachment | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @deepseek-ai/dsh-brand | transitive-package | 0.2.1-rc.2 | npm: @deepseek-ai/dsh-brand | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @deepseek-ai/dsh-commands | transitive-package | 0.2.1-rc.2 | npm: @deepseek-ai/dsh-commands | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @deepseek-ai/dsh-compaction-basic | host-sdk | 0.2.1-rc.2 | npm: @deepseek-ai/dsh-compaction-basic | 插件调用的宿主SDK接口，随dsh预览版本校验兼容 |
| @deepseek-ai/dsh-compaction-image-offload | transitive-package | 0.2.1-rc.2 | npm: @deepseek-ai/dsh-compaction-image-offload | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @deepseek-ai/dsh-compaction | host-sdk | 0.2.1-rc.2 | npm: @deepseek-ai/dsh-compaction | 插件调用的宿主SDK接口，随dsh预览版本校验兼容 |
| @deepseek-ai/dsh-fs | transitive-package | 0.2.1-rc.2 | npm: @deepseek-ai/dsh-fs | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @deepseek-ai/dsh-llm-retry | transitive-package | 0.2.1-rc.2 | npm: @deepseek-ai/dsh-llm-retry | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @deepseek-ai/dsh-llm | host-sdk | 0.2.1-rc.2 | npm: @deepseek-ai/dsh-llm | 插件调用的宿主SDK接口，随dsh预览版本校验兼容 |
| @deepseek-ai/dsh-ptc-runtime | transitive-package | 0.2.1-rc.2 | npm: @deepseek-ai/dsh-ptc-runtime | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @deepseek-ai/dsh-sandbox-policy | transitive-package | 0.2.1-rc.2 | npm: @deepseek-ai/dsh-sandbox-policy | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @deepseek-ai/dsh-sandbox | transitive-package | 0.2.1-rc.2 | npm: @deepseek-ai/dsh-sandbox | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @deepseek-ai/dsh-scope | transitive-package | 0.2.1-rc.2 | npm: @deepseek-ai/dsh-scope | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @deepseek-ai/dsh-session-projection | transitive-package | 0.2.1-rc.2 | npm: @deepseek-ai/dsh-session-projection | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @deepseek-ai/dsh-session | host-sdk | 0.2.1-rc.2 | npm: @deepseek-ai/dsh-session | 插件调用的宿主SDK接口，随dsh预览版本校验兼容 |
| @deepseek-ai/dsh-system-prompt | host-sdk | 0.2.1-rc.2 | npm: @deepseek-ai/dsh-system-prompt | 插件调用的宿主SDK接口，随dsh预览版本校验兼容 |
| @deepseek-ai/dsh-timeout | transitive-package | 0.2.1-rc.2 | npm: @deepseek-ai/dsh-timeout | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @deepseek-ai/dsh-token-meter | transitive-package | 0.2.1-rc.2 | npm: @deepseek-ai/dsh-token-meter | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @deepseek-ai/dsh-tools | host-sdk | 0.2.1-rc.2 | npm: @deepseek-ai/dsh-tools | 插件调用的宿主SDK接口，随dsh预览版本校验兼容 |
| @deepseek-ai/dsh-typert-protocol | transitive-package | 0.2.1-rc.2 | npm: @deepseek-ai/dsh-typert-protocol | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @deepseek-ai/dsh-user-approval | transitive-package | 0.2.1-rc.2 | npm: @deepseek-ai/dsh-user-approval | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @deepseek-ai/dsh-util-crypto | transitive-package | 0.2.1-rc.2 | npm: @deepseek-ai/dsh-util-crypto | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @deepseek-ai/dsh-util-values | transitive-package | 0.2.1-rc.2 | npm: @deepseek-ai/dsh-util-values | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @deepseek-ai/dsh-working-directory | transitive-package | 0.2.1-rc.2 | npm: @deepseek-ai/dsh-working-directory | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @deepseek-ai/schemastery | host-sdk | 3.18.5 | npm: @deepseek-ai/schemastery | 插件调用的宿主SDK接口，随dsh预览版本校验兼容 |
| @standard-schema/spec | transitive-package | 1.1.0 | npm: @standard-schema/spec | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @types/node | development-package | 24.19.2 | npm: @types/node | 插件运行或构建/测试依赖 |
| @types/nodemailer | development-package | 8.0.2 | npm: @types/nodemailer | 插件运行或构建/测试依赖 |
| @types/semver | development-package | 7.7.1 | npm: @types/semver | 插件运行或构建/测试依赖 |
| @types/ws | development-package | 8.18.2 | npm: @types/ws | 插件运行或构建/测试依赖 |
| @typescript/typescript-aix-ppc64 | transitive-package | 7.0.2 | npm: @typescript/typescript-aix-ppc64 | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @typescript/typescript-darwin-arm64 | transitive-package | 7.0.2 | npm: @typescript/typescript-darwin-arm64 | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @typescript/typescript-darwin-x64 | transitive-package | 7.0.2 | npm: @typescript/typescript-darwin-x64 | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @typescript/typescript-freebsd-arm64 | transitive-package | 7.0.2 | npm: @typescript/typescript-freebsd-arm64 | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @typescript/typescript-freebsd-x64 | transitive-package | 7.0.2 | npm: @typescript/typescript-freebsd-x64 | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @typescript/typescript-linux-arm64 | transitive-package | 7.0.2 | npm: @typescript/typescript-linux-arm64 | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @typescript/typescript-linux-arm | transitive-package | 7.0.2 | npm: @typescript/typescript-linux-arm | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @typescript/typescript-linux-loong64 | transitive-package | 7.0.2 | npm: @typescript/typescript-linux-loong64 | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @typescript/typescript-linux-mips64el | transitive-package | 7.0.2 | npm: @typescript/typescript-linux-mips64el | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @typescript/typescript-linux-ppc64 | transitive-package | 7.0.2 | npm: @typescript/typescript-linux-ppc64 | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @typescript/typescript-linux-riscv64 | transitive-package | 7.0.2 | npm: @typescript/typescript-linux-riscv64 | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @typescript/typescript-linux-s390x | transitive-package | 7.0.2 | npm: @typescript/typescript-linux-s390x | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @typescript/typescript-linux-x64 | transitive-package | 7.0.2 | npm: @typescript/typescript-linux-x64 | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @typescript/typescript-netbsd-arm64 | transitive-package | 7.0.2 | npm: @typescript/typescript-netbsd-arm64 | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @typescript/typescript-netbsd-x64 | transitive-package | 7.0.2 | npm: @typescript/typescript-netbsd-x64 | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @typescript/typescript-openbsd-arm64 | transitive-package | 7.0.2 | npm: @typescript/typescript-openbsd-arm64 | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @typescript/typescript-openbsd-x64 | transitive-package | 7.0.2 | npm: @typescript/typescript-openbsd-x64 | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @typescript/typescript-sunos-x64 | transitive-package | 7.0.2 | npm: @typescript/typescript-sunos-x64 | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @typescript/typescript-win32-arm64 | transitive-package | 7.0.2 | npm: @typescript/typescript-win32-arm64 | 锁文件间接依赖，核对引入它的上层包后再更新 |
| @typescript/typescript-win32-x64 | transitive-package | 7.0.2 | npm: @typescript/typescript-win32-x64 | 锁文件间接依赖，核对引入它的上层包后再更新 |
| acorn | development-package | 8.19.0 | npm: acorn | 插件运行或构建/测试依赖 |
| nodemailer | runtime-package | 10.2.1 | npm: nodemailer | 插件运行或构建/测试依赖 |
| playwright-core | transitive-package | 1.64.1 | npm: playwright-core | 锁文件间接依赖，核对引入它的上层包后再更新 |
| playwright | development-package | 1.64.1 | npm: playwright | 插件运行或构建/测试依赖 |
| semver | runtime-package | 7.8.5 | npm: semver | 插件运行或构建/测试依赖 |
| typescript | development-package | 7.0.2 | npm: typescript | 插件运行或构建/测试依赖 |
| undici-types | transitive-package | 7.24.6 | npm: undici-types | 锁文件间接依赖，核对引入它的上层包后再更新 |
| ws | development-package | 8.22.0 | npm: ws | 插件运行或构建/测试依赖 |
| yaml | development-package | 2.9.1 | npm: yaml | 插件运行或构建/测试依赖 |
| zod | transitive-package | 4.4.3 | npm: zod | 锁文件间接依赖，核对引入它的上层包后再更新 |
| zod | transitive-package | 4.6.7 | npm: zod | 锁文件间接依赖，核对引入它的上层包后再更新 |
| react | host-provided-module | 首次公开观测建立基准，非已适配证明 | npm: react | 源码引用的宿主提供模块；未随本插件锁定的版本仅按公开发行观测，实际兼容需随dsh核对 |
| @deepseek-ai/dsh-client-ui-primitives | host-provided-module | 0.2.1-rc.2 | npm: @deepseek-ai/dsh-client-ui-primitives | 源码引用的宿主提供模块；未随本插件锁定的版本仅按公开发行观测，实际兼容需随dsh核对 |
| ,
			quietEnd:  | host-provided-module | 首次公开观测建立基准，非已适配证明 | npm: ,
			quietEnd:  | 源码引用的宿主提供模块；未随本插件锁定的版本仅按公开发行观测，实际兼容需随dsh核对 |
| dsh-persona-memory正式发行 | upstream | 2.4.2 | github: Geng-zy/dsh-persona-memory | 本插件公开正式发行；不自动下载安装 |
| QQ接入插件可选联动 | upstream | 2.4.2 | github: Geng-zy/dsh-qq-gateway | 可选插件间事件与服务接口兼容；独立安装不要求另一个插件在场 |
| DeepSeek Harness | upstream | 0.2.1-rc.2 | npm: @deepseek-ai/dsh | 宿主公开发行与插件SDK兼容，允许预览版；不扫描宿主安装情况 |
| Node.js LTS | upstream | 24.22.1 | node-lts: https://nodejs.org/dist/index.json | 插件运行/开发所需的上游最新LTS；不检测服务器安装 |
| Jina Reader公开网页读取后备 | service | 首次公开观测建立基准，非已适配证明 | document: https://jina.ai/reader/ | 可选公开文档读取后备服务；仅发送公开来源URL，不发送凭据、配置或业务数据 |
| pnpm | upstream | 11.28.5 | npm: pnpm | 仓库安装、锁文件及发布工具 |
| GNU tar归档工具 | external-tool-reference | 首次公开观测建立基准，非已适配证明 | document: https://www.gnu.org/software/tar/ | 仅跟踪插件相关工具的公开版本/发布资料，不检查或修改宿主安装；首次观测不是已适配基准 |
| gzip压缩格式/归档工具 | external-tool-reference | 首次公开观测建立基准，非已适配证明 | document: https://www.gnu.org/software/gzip/ | 仅跟踪插件相关工具的公开版本/发布资料，不检查或修改宿主安装；首次观测不是已适配基准 |
| SQLite（随Node提供） | external-tool-reference | 首次公开观测建立基准，非已适配证明 | document: https://www.sqlite.org/changes.html | 仅跟踪插件相关工具的公开版本/发布资料，不检查或修改宿主安装；首次观测不是已适配基准 |
| Python安装/开发工具 | external-tool-reference | 首次公开观测建立基准，非已适配证明 | document: https://www.python.org/downloads/ | 仅跟踪插件相关工具的公开版本/发布资料，不检查或修改宿主安装；首次观测不是已适配基准 |
| Git源码/发布工具 | external-tool-reference | 首次公开观测建立基准，非已适配证明 | document: https://git-scm.com/downloads | 仅跟踪插件相关工具的公开版本/发布资料，不检查或修改宿主安装；首次观测不是已适配基准 |
| curl下载引导工具 | external-tool-reference | 首次公开观测建立基准，非已适配证明 | document: https://curl.se/changes.html | 仅跟踪插件相关工具的公开版本/发布资料，不检查或修改宿主安装；首次观测不是已适配基准 |
| Bash脚本工具 | external-tool-reference | 首次公开观测建立基准，非已适配证明 | document: https://www.gnu.org/software/bash/ | 仅跟踪插件相关工具的公开版本/发布资料，不检查或修改宿主安装；首次观测不是已适配基准 |
| libarchive/bsdtar可选归档实现 | external-tool-reference | 首次公开观测建立基准，非已适配证明 | github: libarchive/libarchive | macOS等环境的tar实现兼容参考；不检查本机版本 |
| OpenAI兼容接口 | service | 首次公开观测建立基准，非已适配证明 | document: https://developers.openai.com/api/docs/deprecations | 记忆整理/压缩/审核/抽取/向量接口对接的公开模型与弃用资料变化；未配置项也覆盖 |
| DeepSeek模型与接口 | service | 首次公开观测建立基准，非已适配证明 | document: https://api-docs.deepseek.com/updates/ | 记忆整理/压缩/审核/抽取/向量接口对接的公开模型与弃用资料变化；未配置项也覆盖 |
| 硅基流动向量/模型服务 | service | 首次公开观测建立基准，非已适配证明 | document: https://docs.siliconflow.cn/cn/release-notes/overview | 记忆整理/压缩/审核/抽取/向量接口对接的公开模型与弃用资料变化；未配置项也覆盖 |
| 百炼模型接口 | service | 首次公开观测建立基准，非已适配证明 | document: https://help.aliyun.com/zh/model-studio/developer-reference/api-details | 记忆整理/压缩/审核/抽取/向量接口对接的公开模型与弃用资料变化；未配置项也覆盖 |
| 智谱模型接口 | service | 首次公开观测建立基准，非已适配证明 | document: https://docs.bigmodel.cn/cn/guide/start/model-overview | 记忆整理/压缩/审核/抽取/向量接口对接的公开模型与弃用资料变化；未配置项也覆盖 |
| 火山方舟接口 | service | 首次公开观测建立基准，非已适配证明 | document: https://www.volcengine.com/docs/82379 | 记忆整理/压缩/审核/抽取/向量接口对接的公开模型与弃用资料变化；未配置项也覆盖 |
| OpenRouter | service | 首次公开观测建立基准，非已适配证明 | document: https://openrouter.ai/docs/changelog | 记忆整理/压缩/审核/抽取/向量接口对接的公开模型与弃用资料变化；未配置项也覆盖 |
| BAAI/bge-m3向量模型 | resource | 首次公开观测建立基准，非已适配证明 | github-file: FlagOpen/FlagEmbedding / README.md | 默认向量模型来源/检索框架公开说明；API提供商实际模型版本另需核实 |
| Anthropic报告API | service | 首次公开观测建立基准，非已适配证明 | document: https://platform.claude.com/docs/en/release-notes/api | 独立报告模型模板的公开接口与弃用说明 |
| 魔搭报告API | service | 首次公开观测建立基准，非已适配证明 | document: https://modelscope.cn/docs/model-service/API-Inference/intro | 独立报告模型模板的公开接口与弃用说明 |

## 覆盖边界

- 清单覆盖仓库锁文件全部npm直接/间接依赖、SDK、移植代码和已声明的外部接入；不扫描宿主安装软件。
- 公开资料型服务没有可靠版本API时比较正文摘要，首次只建立基线；页面改版、脚本渲染、缺少历史或访问失败均须人工核实。
- 自定义HTTP、本地命令、第三方模型/工作流/插件和用户后加的工具无法从私有配置推断；请在补充上游中登记公开来源与适配基准。报告不会读取命令或密钥。
- npm稳定版本不等于适配兼容；dsh/SDK预览版也必须做回归。间接依赖优先通过上层包升级。安全公告只覆盖OSV已收录的npm版本。
- 当前报告记录仓库发布基准，不能代表服务器实际安装；部署状态由接手者获得授权后核对。
- 邮件/微信厂商的账号额度、地域、服务端灰度和不公开变更无法保证自动识别；报告列出来源和未决项，不宣称覆盖上游未公开信息。
