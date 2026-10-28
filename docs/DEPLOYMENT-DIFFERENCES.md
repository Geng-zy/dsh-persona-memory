# 当前与官方默认的差异

2026-10-28，按用户明确要求：除dsh反向WS接入及容器访问宿主的方法外，其他此前额外部署设置全部恢复官方默认。当前模板以官方镜像框架3f388b1的Compose为基准，逐项结构比对后仅增加extra_hosts中的host.docker.internal:host-gateway。

## 保留的接入配置

1. OneBot的networks.wsClients保留dsh客户端，地址ws://host.docker.internal:6199/ws，Token匹配插件，消息array、角色Universal。
2. Compose增加host.docker.internal:host-gateway，以不写死宿主IP的方式连接宿主dsh。

客户端是SnowLuma已有功能的配置，不是修改其业务源码。HTTP API3000和正向WS3001均为官方原有接口。

## 已恢复默认

| 项目 | 当前值/行为 |
|---|---|
| 镜像 | motricseven7/snowluma:latest，当前核验对应2.2.1，官方层及启动配置与已有镜像一致，没有跨版本升级 |
| 容器名称 | snowluma |
| 启动 | 原官方入口及脚本；自定义start-snowluma.sh和alwaysshared修改删除 |
| QQ参数 | 官方禁用GPU的默认参数，移除-q和固定账号 |
| 内存/日志 | 删除1800MiB上限和10m×3轮转，跟随Docker/宿主默认 |
| 存储 | qq-gateway-data、qq-client-config、qq-client-data三个官方命名卷，已迁移原数据而非使用空卷 |
| 端口/环境变量 | 沿用官方名称和默认数值，发布5099/6081/3000/3001；未指定宿主IP，使用Docker默认发布范围 |
| OneBot服务 | http-default:3000及ws-default:3001恢复，保留既有凭据；反向WS客户端另外保留 |
| 内置状态命令 | statusCommand.enabled=true，恢复#sl默认回复；其回复独立于插件白名单 |
| 本机附加工具 | 删除此前额外创建的打开/关闭SSH和网页启动脚本；日常直接访问公网5099/6081 |

VNC修复撤销后按官方桌面连接行为运行。命名卷切换前停止QQ并对迁移的3694文件逐项校验，管理密码、VNC密码、QQ数据和dsh资料保留。内存/日志恢复默认不等于删除已有日志或用户资料。此前镜像中转仅属历史下载过程，没有需要恢复的运行参数。

普通插件权限、记忆、媒体及备份功能未改；用户本次要求恢复SnowLuma内置#sl意味着该命令可以独立直接回复，并不经过插件白名单。

完整部署及迁移前提见[SnowLuma部署](SNOWLUMA.md)。官方来源：[Compose](https://github.com/SnowLuma/SnowLuma.Docker.Framework/blob/3f388b1/docker-compose.yml)、[OneBot配置](https://github.com/SnowLuma/SnowLuma/blob/v2.2.1/packages/onebot/src/config.ts)。先前逐项差异和撤销原因可从本文件Git历史查阅。
