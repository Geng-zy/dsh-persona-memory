# 与 dsh、SnowLuma 及依赖的职责边界

核对日期：2026-10-28。目标版本：dsh/SDK 0.2.1-rc.2、SnowLuma v2.2.1、dsh-snowluma-companion 1.0.0（桥接与陪伴核心已合并）。

## 功能重叠和冲突

| 功能 | 分工与结论 |
|---|---|
| QQ 收发和重连 | SnowLuma 实现 QQ 协议、媒体上传下载和 WS 客户端重连；bridge 提供 OneBot WS 服务端与 dsh 会话映射。两端是同一连接的两侧。 |
| 自动回复 | SnowLuma 默认的 `#sl` 状态命令会直接回复，绕过 bridge 的唤醒和白名单。因此接入时关闭 `statusCommand.enabled`，并核对账号独立配置。bridge 的协议格式错误仅记录诊断，不直接回复。 |
| 白名单 | 由 bridge 控制模型入口和插件发送。companion-core 复用实时权限，分别约束存档和主动聊天；主动群发没有管理员来信豁免。其他独立 OneBot 客户端或直接调用协议 API 的程序不归这套规则管。 |
| 自己的消息 | 建议 SnowLuma 上报配置 `reportSelfMessage=false`。bridge 的忽略自己消息选项是入口控制，短期去重缓存用于重复上报，均不替代协议端配置。 |
| 消息存储 | SnowLuma 的消息库用于 `get_msg`、引用和协议功能；QQ 客户端也维护自身数据。core 的 SQLite 存档保存业务聊天，dsh 会话日志保存交给模型的消息、工具及压缩事件。用途不同，存在内容交集。**插件白名单仅控制插件存档，不能保证 SnowLuma/QQ 本地零留存。**`historySync.enabled=false` 仅关闭历史同步，不关闭实时协议缓存。 |
| 人格 | core 在系统提示组装时放入人格和核心记忆。陪伴预设不加载 `dsh-persona`。其他预设若启用了 `dsh-persona.complete=true`，可能恢复自己的完整提示，盖过 core；应将其排除出 core 生效范围，或明确关闭 complete。 |
| 上下文压缩 | companion/context 继承 dsh 的 BasicCompactionEngine，复用事务、工具配对与压缩命令，替换触发与摘要策略；陪伴预设用它替换 compaction-basic，两者不并列装载。工具结果裁剪仍由 dsh 自带 pruner 执行，处理目标不同。 |
| 记忆 | core 的核心记忆、长期记忆、召回、日记与图关系构成业务记忆；dsh 的会话压缩只整理当前模型上下文。整理游标减少同一记录重复提取，日记与摘要保留各自用途。 |
| 主动聊天和计划任务 | core 的定时器按间隔检查 QQ 会话，让普通回复模型决定是否发送；dsh 的 schedule 工具用于显式创建任务。两者可共存；若人为创建相同提醒，会按各自任务执行。 |
| 时间提示 | bridge 的消息时间提示与 dsh 的 time-context 有文字重叠，但作用位置不同；两项可独立设置，不自动删除任何一项。 |
| 语音和视频 | bridge 的 STT 可用本机命令或独立接口，TTS 使用配置的服务商，视频由宿主 ffmpeg 抽帧。SnowLuma 提供媒体取得、格式转换及可选 QQ 语音识别 API；dsh 也带实验性 speechToText 服务及网页录音接口，当前 bridge 未调用它，继续支持独立 API 与本机命令，属于能力重叠。每条 QQ 语音只执行当前选择的一条识别路径，不会同时调用 dsh、QQ 识别和外部识别。容器内 ffmpeg 负责协议端媒体处理，不代表 dsh 宿主可直接使用它。 |
| 备份 | core 普通备份包含勾选的业务资料、主人会话及脱敏设置，不覆盖 SnowLuma/QQ 登录目录、Docker 镜像和操作系统。协议端自己的备份与普通备份对象不同。 |
| 模型列表 | 合并包中的两个模块共享同一份模型列表工具，消除原来的重复实现。dsh 任务模型优先使用宿主模型服务，独立 API 仅用于明确选择的任务。 |

## 合并后的内部模块

一个安装包和设置入口装载桥接、陪伴核心、上下文三个内部组件；保留原设置行 ID、服务、API、数据路径与预设 ID，避免重置用户配置。桥接负责实时权限和 QQ 收发，核心负责存档与记忆等业务；统一设置页把两份配置按用途组织，保存时分别校验并等待各自持久化。普通及主动回复共用桥接的不发送标记，旧核心字段仅用于兼容设置和备份。

## Docker 与用户权限

Docker Engine 是系统级软件。普通 rootful 安装由包管理器写入系统目录，systemd 启动的 `dockerd` 以 root 运行。通过管理账号执行 `sudo apt ...` 或 `sudo docker compose ...`，执行时仍使用 root 权限；部署文件放在管理账号家目录不改变这一点。

部署目录、Docker 守护进程、容器启动辅助进程、容器内 QQ/SnowLuma 业务进程是不同层次。官方镜像启动辅助程序可能需要容器 root，再以配置的 UID/GID 运行 QQ 和业务进程；不能把这表述为整个容器从启动起都是普通用户。dsh 使用独立无 sudo 的业务账号运行，避免直接共享 QQ 登录目录或 Docker 控制权。

`docker` 组通常拥有相当于宿主 root 的控制能力；本方案使用显式 sudo，不需要把 dsh 用户加入该组。Rootless Docker 是另一种部署模式，与“普通账号加 sudo 管理 rootful Docker”不同。

参考：[Docker 官方安装后配置](https://docs.docker.com/engine/install/linux-postinstall/)、[Rootless 模式](https://docs.docker.com/engine/security/rootless/)。SnowLuma 行为依据 v2.2.1 的 `packages/onebot/src/config.ts`、`instance.ts`、`message-store.ts` 和媒体接口实现；dsh 行为依据安装版本的预设与 SDK 实现。
