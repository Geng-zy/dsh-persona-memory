# QQ 接入助手与人格记忆插件

本仓库从 2.0.0 起提供两个独立的 dsh 插件。仓库地址保持不变。

| 插件 | 包名 | 功能 |
| --- | --- | --- |
| QQ 接入助手 | `dsh-qq-gateway` | SnowLuma/OneBot 连接、QQ工作区、权限和白名单、回复节奏、群上下文和消息存档、语音/视频/文件/图片生成、主动聊天、掉线提醒、QQ数据备份恢复 |
| 人格与记忆 | `dsh-persona-memory` | 人格、分域核心记忆、长期记忆与关系图、日记、记忆整理和上下文压缩、人格记忆数据备份恢复 |

## 已有 dsh：安装插件

适用于 dsh **0.2.1-rc.2**、Node **≥22.13**。先等待正在回复或生图的任务完成，停止 dsh；以运行 dsh 的同一系统账号和相同 `DSH_HOME` 执行：

```sh
dsh plugin --profile web add "https://github.com/Geng-zy/dsh-snowluma-companion/releases/download/v2.0.2/dsh-qq-gateway-2.0.2.tgz" --ignore-scripts
dsh plugin --profile web add "https://github.com/Geng-zy/dsh-snowluma-companion/releases/download/v2.0.2/dsh-persona-memory-2.0.2.tgz" --ignore-scripts
```

可以只执行其中一条。只装QQ插件使用dsh默认人格；只装人格插件默认等待QQ接入，也可将“会话生效范围”改为全部会话。两者共同安装时QQ新会话采用陪伴预设。插件不会自动修改普通网页会话的全局默认预设。

重新启动后进入 **更多 → 设置 → QQ 接入助手 / 人格与记忆**；插件管理页也提供相同设置。分类可折叠，同时只展开一个。

**已有旧版统一插件时不要直接叠加安装。** 请先按[拆分迁移说明](docs/SPLIT-MIGRATION.md)迁移配置和数据；保留原QQ历史，校验复制后才归档原会话。

[插件安装详细说明](docs/PLUGIN-INSTALL.md) · [发行页](https://github.com/Geng-zy/dsh-snowluma-companion/releases/tag/v2.0.2)

## 新服务器部署

支持Ubuntu 22.04/24.04/26.04、systemd、amd64/arm64。26.04尚未完成整机虚拟机安装实测。安装器用于全新环境，已有数据时会停止，避免覆盖。

```sh
curl -fsSL https://raw.githubusercontent.com/Geng-zy/dsh-snowluma-companion/main/install.sh | sudo bash
```

交互填写账号、端口、密码、主人QQ、Token及模型接口；部署Node、dsh、两个插件和官方SnowLuma Docker环境。完成后显示网址与凭证，并保存私有凭证文件。QQ扫码须本人完成。

[一键安装](docs/INSTALL.md) · [手动安装图文教程](docs/MANUAL-INSTALL.md) · [部署差异](docs/DEPLOYMENT-DIFFERENCES.md)

![部署结构与端口](docs/images/deployment.svg)

## QQ工作区与权限

启用QQ插件时自动创建并注册 `DSH_HOME/workspaces/QQ`，在“连接与权限”中可填写其他绝对路径。新QQ会话自动进入该工作区；修改路径后，空闲旧会话完整复制到目标工作区，校验后切换映射并归档原会话。运行中的会话延后迁移。

管理员保持原有最高QQ权限，不受白名单约束。群聊与其他人私聊使用各自白名单；未获准会话不存档、不触发主动聊天。回复打字速度分管理员私聊、其他私聊和群聊，最长等待默认5/8/8秒。[回复规则](docs/CHAT-PACING.md) · [QQ媒体发送](docs/QQ-SENDING.md)

## 人格与记忆

默认只作用于QQ会话。人格最新稿在下一次模型请求读取，旧会话也无需/reset。公共核心记忆对所有受管会话可见；管理员私聊、群聊、其他私聊另有各自核心记忆稿。长期记忆按管理员私聊、每个群、每位普通私聊用户分域。管理员可汇总读取全部域，普通会话仅能读取公共域和自己的域。

**隔离边界是记忆接口。** 按当前设计保留原终端、文件等工具权限，没有增加操作系统文件沙箱；这些工具仍可能读取工作区外文件。不能将记忆接口分域描述为文件访问隔离。

[人格编辑机制](docs/PERSONA.md) · [人格插件说明](packages/dsh-persona-memory/README.md)

![人格编辑器](docs/images/persona-editor.png)

## 各自备份与恢复

| 插件 | 可选备份项目 |
| --- | --- |
| QQ 接入助手 | 管理员私聊消息存档、管理员私聊dsh完整会话、QQ插件设置 |
| 人格与记忆 | 人格、核心记忆、日记、长期记忆与关系图、人格插件设置 |

两个插件各有独立目录、定时计划和保留数量，默认各保留5份；手动、定时、恢复前备份统一计数，新包成功后删除最旧包。设置不包含密钥。人格和核心记忆备份只保留现稿。上传`.tar.gz`只识别内容，勾选一个或多个项目并确认后才恢复；未选数据保留。旧统一包可以分别在两个插件中识别其所属项目，新版包不会跨插件恢复。

QQ登录状态、SnowLuma程序、Node、dsh运行依赖和生成图库不属于这些备份；没有完整环境备份或电脑自动同步功能。

## 模型与生图

[魔搭聊天兼容设置](docs/MODELSCOPE.md) · [图片生成提供商与本地方法](docs/IMAGE-GENERATION.md) · [SnowLuma接入](docs/SNOWLUMA.md)

图片生成仍由QQ插件提供，保留普通网页会话工具附件与设置页试画。各提供商需要有效接口和自己的密钥/额度，不能保证任意模型与协议均可互换。

## 开发

```sh
pnpm install
pnpm run build
pnpm test
```

服务端源码位于`src/`，人格包位于`packages/dsh-persona-memory/`；构建同时生成两个可独立安装的包。端到端测试使用隔离dsh和假模型、假OneBot，不发送真实QQ消息。

许可证：[AGPL-3.0-or-later](LICENSE)。
