# 与 SnowLuma 官方部署的差异及原因

核对日期2026-10-28，当前SnowLuma v2.2.1、官方镜像框架3f388b1。依据服务器实际容器参数、全局/账号OneBot配置与本仓库模板逐项比对。官方来源：[Compose模板](https://github.com/SnowLuma/SnowLuma.Docker.Framework/blob/3f388b1/docker-compose.yml)、[OneBot默认配置](https://github.com/SnowLuma/SnowLuma/blob/v2.2.1/packages/onebot/src/config.ts)。本方案不能描述为“所有设置均为官方默认”。

| 修改 | 当时为什么这样做 | 性质与影响 |
|---|---|---|
| 曾将宿主5099/6081限制为127.0.0.1 | 限制管理页面只经SSH访问 | 额外访问限制，并非接入所需。已按用户要求撤销；1.1.1起明确发布0.0.0.0。 |
| 本机15099/16081 SSH转发 | 在上述限制下访问管理页和远程桌面 | 额外访问步骤，不是官方必需。之后的双击打开/关闭脚本只用于手动管理转发，不设开机启动或同步。现按用户要求关闭转发测试公网。 |
| QQ参数增加-q及原账号 | 尝试复用现有账号快速登录 | 额外启动选择，官方默认没有这一固定账号。不能保证重启免扫码；换号后若要改变重启目标需维护该参数，增加了操作复杂度。 |
| x11vnc增加-alwaysshared | 修复此前凭证正确仍被遗留VNC连接拒绝的问题 | 已有故障修复，允许通过认证的连接共享桌面；保留原密码认证。 |
| Compose替换entrypoint并挂载start-snowluma.sh | 容器重建会丢失手动修改的VNC启动行，需要保存上面的修复 | 额外启动包装：先修补原/root/start.sh的VNC参数，再执行原脚本；不是修改SnowLuma业务源码。 |
| 内存上限1800m（1800MiB） | 为与dsh共用4GB主机分配资源 | 额外资源限制，数值由本部署选定，不是官方建议值；会限制QQ容器的可用内存。 |
| Docker日志10m、最多3文件 | 限制容器日志占用服务器磁盘 | 额外运维设置；仅控制Docker日志轮转，不等同于QQ/SnowLuma消息存储。 |
| 命名卷改为./data、./qq-config、./qq-share目录 | 便于定位数据、管理宿主权限和手动迁移 | 额外存储组织选择，容器内三个数据路径保持官方路径。不是普通插件备份的一部分。 |
| 镜像固定motricseven7/snowluma:v2.2.1 | 避免重建时随latest自动换版本 | 额外版本固定，镜像仍来自官方；更新需要明确变更版本。 |
| 容器名改为dsh-snowluma | 便于区分该dsh部署的服务 | 命名选择，不影响QQ协议。 |
| 添加WS客户端连接插件6199/ws，并配置匹配Token | 将QQ消息和API响应接入dsh，接收插件调用 | 当前接入方式需要的配置；官方支持该能力，但默认客户端列表为空。6199沿用插件既有默认，不是SnowLuma默认监听端口。 |
| 添加host.docker.internal:host-gateway | 让容器内的WS客户端访问宿主dsh | 容器与宿主之间的接入适配，不是公网监听设置。 |
| HTTP3000改名local-check、仅容器内部使用；移除正向WS监听；不发布3000/3001 | 保留内部诊断接口，当前dsh使用反向WS，没有使用另外两种公网接入方式 | 为当前方案裁剪监听服务，并非SnowLuma强制要求；若其他客户端需要HTTP或正向WS，应另行配置。 |
| statusCommand.enabled=false | 防止SnowLuma内置#sl直接回复，绕过插件的白名单和唤醒规则 | 为满足用户要求的统一发言权限而调整；副作用是内置#sl状态命令不再自动回复。全局和当前账号配置均核对。 |
| 端口环境变量自行命名，容器WebUI端口写死5099 | 整理部署模板时统一前缀并简化端口配置 | 非接入必要。使用SNOWLUMA_NOVNC_PORT/SNOWLUMA_WEBUI_PORT，未沿用官方NOVNC_PORT/SNOWLUMA_WEBUI_HOST_PORT，也未提供独立容器WebUI端口变量；默认端口值相同，但降低了模板可直接互换性。 |

安装过程还有一次镜像获取方式的调整：因服务器无法直接从Docker Hub取得镜像，在本机下载官方层并校验后中转到服务器，再转换为Docker可加载归档。它改变镜像获取/导入过程，没有改SnowLuma业务代码；来源和层校验记录保存在私有交接。

仍沿用官方的主要值：管理端口5099/6081、UID/GID1000、1GB共享内存、自动注入、SYS_PTRACE与seccomp参数、文件句柄上限、unless-stopped重启策略。array、Universal、reportSelfMessage=false及historySync.enabled=false对应所用官方默认。VNC和QQ扫码属于官方Docker流程；SSH不是官方强制步骤。

后续约定：以官方默认为基准，区分用户要求、接入适配及额外运维选择。任务范围之外的监听、资源和启动行为调整先说明，不自行附加；本次仅核验和列出差异，不擅自撤销其余配置。
