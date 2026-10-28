# SnowLuma Companion · 陪伴助手

将 SnowLuma 的 QQ 接入、人格与核心记忆、长期记忆、日记、主动聊天和备份整合为一个 dsh 插件。包名及仓库为 **dsh-snowluma-companion**，由原 bridge 仓库继续维护，合入 companion-core 的代码与提交历史。

## 安装与升级

要求 dsh **0.2.1-rc.2** 对应 SDK、Node **≥22.13**（使用内置 SQLite）。在 dsh 插件管理页安装本仓库 [v1.0.0](https://github.com/Geng-zy/dsh-snowluma-companion/releases/tag/v1.0.0) 的 `.tgz`。只需安装一个包；QQ 协议端仍由官方 SnowLuma Docker 镜像运行。

从两个旧插件升级时，停止 dsh，保留现有数据与 profile 配置，以 profile 所属用户执行：

```sh
node /解包目录/deploy/migrate-profile.mjs /绝对路径/profiles/web /绝对路径/dsh-snowluma-companion-1.0.0.tgz
cd /绝对路径/profiles/web
pnpm install
```

随后启动 dsh。迁移脚本合并 bundle 与包引用，并更新 profile 中显式的旧模块路径。内部 `snowluma-bridge`、`companion-core` 配置行继续使用原命名空间，已保存设置和凭据无需重新填写。平台 ID、QQ 会话绑定、存储目录、SQLite schema 5 和备份格式 3 保持；不要通过清空数据重新安装来合并。

## 一个统一设置入口

设置页按用途组织，支持搜索全部设置、独立折叠、全部展开/收起、浏览器记忆展开状态，以及跨分组统一保存设置。已打开的编辑器在分组切换和收起后保留草稿；人格、核心记忆、日记正文使用编辑器内的保存按钮。

| 分组 | 内容 |
|---|---|
| 运行概览 | QQ 模块与存储状态、常用入口 |
| 连接与权限 | OneBot 连接、管理员、群/私聊白名单、会话例外规则 |
| 聊天与回复 | 唤醒、模型/预设、上下文、群上下文、分段、打字节奏、群回复 @ 与引用 |
| 人格与核心记忆 | 正文编辑、历史版本、预设生效范围、自主修改限制 |
| 记忆与存档 | 消息存档、召回、向量、关系图、记忆管理 |
| 日记与主动聊天 | 日记和月度总览、阅读、主动间隔与免打扰 |
| 图片、语音与视频 | 图片输入、STT、TTS、视频抽帧与 ffmpeg |
| 备份与迁移 | 九项备份选择、下载、预览、导入和自检 |
| 维护与通知 | 掉线通知、数据到期、记忆保养、日志 |

## 保留的能力与权限

- 管理员拥有最高回复权限；普通群聊和普通私聊使用独立白名单。空名单拒绝对应普通会话。主动群聊没有管理员来信豁免。
- 唤醒关键词只匹配正文，不匹配 @ 他人的昵称；支持直接 @、引用、前缀、只 @ 等待等既有规则。群回复 @ 与引用默认关闭。
- 名单外群聊的入站、出站与图片均不写入插件存档，包括管理员发言；普通名单外私聊也不存档，管理员私聊允许。
- 人格和公开/主人核心记忆、按轮数截断或第一人称压缩、长期记忆整理/召回/遗忘、向量和图关系、日记、轮换、主动聊天与 `[不发]` 保留。
- 图片、引用与嵌套转发、语音识别、双服务商语音合成、视频抽帧、本地文件/视频发送、发言节奏及掉线提醒保留。
- 普通备份九项：人格现稿、核心现稿、日记、记忆库、主人消息存档、主人 QQ 私聊原始 dsh 会话及引用附件、陪伴设置、QQ 连接与聊天设置、dsh 设置。历史备份可继续导入；不增加完整环境备份或电脑自动同步。

**存储边界**：插件存档、dsh 模型会话日志与 SnowLuma/QQ 协议缓存用途不同。插件白名单不能关闭后两者；`historySync=false` 也不关闭实时协议缓存。详见[集成边界](docs/INTEGRATION.md)。

## 部署与内部接口

[SnowLuma Compose 部署](docs/SNOWLUMA.md)。管理端口通过宿主回环地址与 SSH 访问；反向 WS 使用 Token。关闭 SnowLuma 内置状态命令，避免绕过插件权限直接回复。

内部模块：包根入口负责 QQ 桥接，`/companion` 负责陪伴服务，`/context` 提供陪伴压缩引擎；只发布一个安装包和一个设置页。`ctx.snowluma`、`ctx.companion` 及已有事件保留，便于宿主集成。原 `/api/snowluma-bridge/*` 与 `/api/companion/*` 接口继续服务同一个包内的两个模块。

## 开发验证

```sh
scripts/setup-test-env.sh
scripts/check.sh
```

检查包含构建、统一设置脚本/词典、两部分单元测试、两套真实 dsh + 假模型/SnowLuma e2e 和隐私扫描。测试环境独立于真实 QQ；不需要真实模型 Key。

原桥接历史见 [CHANGELOG](CHANGELOG.md)，原核心历史见 [COMPANION-HISTORY](docs/COMPANION-HISTORY.md)。许可为 AGPL-3.0-or-later，移植来源见 [NOTICE](NOTICE.md)。
