# SnowLuma 部署与数据迁移

本插件从0.21.0起统一使用SnowLuma OneBot v11反向WebSocket。插件包名为`dsh-snowluma-bridge`，设置id为`snowluma-bridge`，服务为`ctx.snowluma`，事件以`snowluma/`开头；配套companion-core ≥ 0.18.0。

## 保持会话与记忆

平台`id`统一为`snowluma`。从既有部署迁移时，先停止dsh，通过宿主会话存储接口重建会话ID及日志内宿主关联，再同步数据库UMO、记忆来源、整理游标、轮换记录、会话映射、工作区和插件配置。聊天正文、人格及记忆文本保留原文。不能只改一个设置字段后继续使用未迁移的旧日志。

## Compose部署

由管理用户安装Docker和Compose，在独立目录放置`deploy/snowluma.compose.yml`与`snowluma.env.example`，后者复制为`.env`，然后：

```sh
sudo docker compose --env-file .env -f snowluma.compose.yml up -d
```

模板使用SnowLuma官方`motricseven7/snowluma:v2.2.1`；生产应核对官方镜像digest并固定版本。`data`保存SnowLuma配置，`qq-config`与`qq-share`保存QQ数据。它们与容器生命周期分开，普通重建会保留；迁移服务器时需单独妥善转移这些目录，不由companion普通备份代管。

管理端口5099/6081只绑定宿主127.0.0.1，通过SSH转发访问。OneBot HTTP/正向WS端口不发布。模板设置host.docker.internal映射为宿主网关，供反向WS访问宿主dsh监听的6199端口。

## 接入配置

在SnowLuma的OneBot配置中添加WebSocket客户端：

```json
{
  "name": "dsh",
  "url": "ws://host.docker.internal:6199/ws",
  "role": "Universal",
  "accessToken": "填写原桥接插件的Token",
  "messageFormat": "array",
  "reportSelfMessage": false,
  "reconnectIntervalMs": 3000
}
```

对应配置文件`config/onebot.json`的`networks.wsClients`；已存在账号独立配置`config/onebot_<QQ>.json`时，也需核对生效的账号配置。关闭SnowLuma自带的`statusCommand.enabled`，避免`#sl`在桥接白名单之外产生额外回复。

先准备镜像、容器和QQ登录界面，正式切换时停止原协议端，确保同一QQ只有一个协议端向桥接上报。登录SnowLuma并确认注入成功，检查桥接设置页显示一条连接、QQ信息正常。不要同时让两个协议端连同一个桥接实例。

宿主6199需要可从Docker网关访问，仍须配置Token。不要向公网新增开放OneBot端口。管理界面可用SSH转发：

```sh
ssh -L 15099:127.0.0.1:5099 -L 16081:127.0.0.1:6081 ubuntu@你的服务器
```

浏览器打开http://127.0.0.1:16081扫码，http://127.0.0.1:15099管理SnowLuma。首次生成的管理/远程桌面密码只保存在私有部署数据中，不写进公开仓库。若界面要求协议确认或扫码，请由账号本人完成。

## 媒体及回退

图片、语音优先使用OneBot可下载地址或返回的base64；dsh不会因为容器返回`/app/...`而要求读取QQ登录目录。宿主发送文件/视频会内联文件内容，转发节点同样处理。外部URL维持原样。视频抽帧仍在dsh一侧执行。

迁移期间保留私有回退副本，验证数据关联及新端登录后清理原协议端程序、服务、配置和安装包。原有数据先验证后切换，不能以删除聊天记录代替标识迁移。普通备份不增加QQ登录态、运行环境或电脑同步功能。

参考：[SnowLuma官方Docker文档](https://snowluma.github.io/zh/docs/guide/deploy/docker)、[官方Compose镜像仓库](https://github.com/SnowLuma/SnowLuma.Docker.Framework)。接口核对版本：SnowLuma v2.2.1（8ffd314），镜像框架3f388b1。
