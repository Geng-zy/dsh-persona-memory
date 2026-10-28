# SnowLuma 官方默认部署与 dsh 接入

统一插件为dsh-snowluma-companion。SnowLuma使用官方Docker Compose默认值，本模板仅增加容器访问宿主所需的host-gateway映射；OneBot配置中另保留接入dsh的反向WS客户端。

## 启动

将deploy/snowluma.compose.yml和snowluma.env.example放到部署目录，后者复制为.env，然后执行：

```sh
sudo docker compose --env-file .env -f snowluma.compose.yml up -d
```

默认镜像motricseven7/snowluma:latest、容器名snowluma，使用原官方启动入口，无自定义启动包装、内存上限、日志轮转或固定QQ账号参数。默认发布6081远程桌面、5099管理页、3000 OneBot HTTP和3001 OneBot正向WS；宿主未指定绑定IP，遵循Docker默认发布范围。公网访问还取决于安全组和网络。

通过http://服务器IP:5099/管理SnowLuma；通过http://服务器IP:6081/vnc.html打开QQ远程桌面并扫码。VNC密码与管理页密码独立，保留现有凭据，不重置用户已修改的管理密码。

## 默认存储

官方三个命名卷：qq-gateway-data挂载/app/data、qq-client-config挂载/app/.config、qq-client-data挂载/app/.local/share。卷与容器生命周期独立；更新时保留这些卷。迁移到其他服务器需要同时迁移卷数据及dsh的配置/用户资料，不能只复制Compose文件就认为登录、会话和记忆也已迁移。

从之前的宿主目录挂载方案改为命名卷时，先停止SnowLuma、复制并校验三个目录的全部数据，再启用新卷。不要启动空卷后删除原目录。本次生产迁移3694个文件校验一致，反向WS和凭据保留。

## OneBot配置

HTTP API及正向WS是官方默认提供的接口，分别使用3000和3001；并不是额外加入的模型服务。本插件当前通过反向WS交换事件和调用，不依赖HTTP API。

在全局config/onebot.json的networks.wsClients中添加：

```json
{
  "name": "dsh",
  "url": "ws://host.docker.internal:6199/ws",
  "role": "Universal",
  "accessToken": "与dsh插件Token一致",
  "messageFormat": "array",
  "reportSelfMessage": false,
  "reconnectIntervalMs": 3000
}
```

若有config/onebot_<QQ>.json账号独立配置，也需核对该客户端是否生效。宿主dsh监听6199并可从Docker网络访问。不要把URL中的主机名改成容器内127.0.0.1；那指向容器自身。

按用户要求恢复官方默认后，statusCommand.enabled=true，内置#sl会由SnowLuma直接回复，独立于dsh插件白名单/唤醒规则。插件本身的白名单和存档限制仍按原规则运行。此前x11vnc的alwaysshared修复已移除，远程桌面现在按官方启动行为运行。

## 宿主访问方法与迁移

| 方法 | 是否能照搬及前提 |
|---|---|
| host.docker.internal:host-gateway | 当前采用。Docker启动容器时解析到本机宿主网关，不写死服务器IP；另一台支持host-gateway的Linux Docker主机可沿用同一URL和映射。仍需宿主dsh监听对应端口、Token匹配。 |
| 宿主内网IP | 可以连接，但换服务器通常要修改URL。 |
| Linux host网络+127.0.0.1 | 容器共享宿主网络，可用回环地址；要更改网络模式并移除端口映射，偏离官方bridge部署，当前不采用。 |
| dsh也容器化，加入同一自定义网络 | 可以通过Compose服务名如dsh:6199连接，适合两者均容器化的方案；当前dsh运行在宿主，不适用现有部署。 |
| 自有域名/其他可路由宿主地址 | 需要维持DNS或地址指向、路由及端口可达，迁移后需相应维护。 |

这里“可照搬”指网络配置不写死某台主机的IP，并不代表可以省去新服务器的Docker安装、dsh安装和数据迁移。

图片、语音等继续通过OneBot可下载地址/base64处理，宿主视频处理使用宿主ffmpeg；不要求dsh读取QQ登录卷。普通插件备份不覆盖QQ登录卷、Docker镜像或操作系统，不新增完整环境备份和电脑自动同步。

来源：[官方Compose](https://github.com/SnowLuma/SnowLuma.Docker.Framework/blob/3f388b1/docker-compose.yml)、[官方OneBot默认配置](https://github.com/SnowLuma/SnowLuma/blob/v2.2.1/packages/onebot/src/config.ts)、[Docker host-gateway](https://docs.docker.com/reference/cli/docker/container/run/#add-entries-to-container-hosts-file---add-host)。当前latest核验仍对应SnowLuma2.2.1；latest不是后台自动更新机制，后续拉取可能取得新版本。
