# 与 SnowLuma 官方部署的差异

核对：2026-10-28，SnowLuma v2.2.1、官方镜像框架3f388b1。官方来源：[Compose模板](https://github.com/SnowLuma/SnowLuma.Docker.Framework/blob/3f388b1/docker-compose.yml)、[OneBot默认配置](https://github.com/SnowLuma/SnowLuma/blob/v2.2.1/packages/onebot/src/config.ts)。这里的模板是为dsh接入维护的部署方案，不能表述成所有设置都与官方默认相同。

| 项目 | 本部署及原因 |
|---|---|
| 宿主端口映射 | 1.1.1起5099/6081显式绑定0.0.0.0，与官方模板默认的全部IPv4网卡发布范围一致。先前额外限制127.0.0.1，已按用户要求撤销。公网可达另受安全组、防火墙影响。 |
| 镜像版本 | 固定官方v2.2.1而非默认latest，避免更新时隐式跨版本。没有修改SnowLuma业务源码。 |
| 模板变量命名 | 本模板使用SNOWLUMA_NOVNC_PORT及SNOWLUMA_WEBUI_PORT控制宿主端口；官方使用NOVNC_PORT及SNOWLUMA_WEBUI_HOST_PORT。默认数值相同；本模板未提供独立的宿主/容器WebUI端口变量。 |
| 容器名称 | dsh-snowluma，便于区分服务。 |
| 内存上限 | 额外设置1800m，即1800 MiB；此前为与dsh共用4GB主机分配资源所加，官方模板没有这一上限。 |
| Docker日志 | 额外设置json-file日志10m、最多3文件，控制磁盘占用。 |
| 持久化 | 官方命名卷改为宿主./data、./qq-config、./qq-share目录；容器内三个数据路径保持官方路径。 |
| 反向WS | 添加host.docker.internal的host-gateway映射、WS客户端连接dsh插件6199/ws、双方Token；官方默认没有这一客户端。6199来自插件既有默认，不是SnowLuma默认监听端口。 |
| OneBot监听 | 使用容器内部HTTP3000作检查，移除正向WS监听，不发布3000/3001到宿主；因为dsh使用反向WS。 |
| 内置状态回复 | 关闭statusCommand.enabled，避免#sl绕过插件白名单直接回复；官方默认开启。 |
| 远程桌面 | 给x11vnc增加-alwaysshared，修复认证后被遗留连接拒绝。当前Compose挂载启动包装脚本，修改该行后执行原/root/start.sh，不改认证密码。早先运行容器曾直接修补该行；重建后由包装脚本保留同一修复。 |
| 可选SSH转发 | 此前选本机15099/16081分别转发服务器5099/6081；这些是本机访问别名，不是更改SnowLuma服务端口。 |
| QQ启动参数 | 生产在官方禁用GPU参数后增加-q及本机已有账号以快速登录；公开模板不包含真实账号。 |

仍沿用官方的主要设置：5099/6081端口、UID/GID1000、1GB共享内存、自动注入、SYS_PTRACE及seccomp配置、文件句柄上限、unless-stopped重启策略。array消息、Universal角色、reportSelfMessage=false和historySync.enabled=false与所用官方默认对应。官方镜像及持久化QQ数据保留，未重置登录、改密或协议确认。

后续约定：以官方默认为基准，明确区分用户要求、接入所需适配与额外运维选择；不在已授权任务之外自行调整监听范围、资源限制或部署行为，必要适配先向用户说明。本轮只按要求恢复管理端口映射，并保留已有其他差异供用户核对，不默默扩大为一次全面重配置。
