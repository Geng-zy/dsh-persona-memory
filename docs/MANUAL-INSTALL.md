# 手动安装图文教程

本教程逐步安装Docker、官方SnowLuma、Node、dsh和统一插件，不执行一键安装器。适用于**全新Ubuntu22.04、24.04、26.04服务器**（amd64/arm64，systemd）；已有服务或数据时，应先备份并阅读[迁移说明](../README.md)，不要覆盖已有配置或数据卷。

Docker官方已将[Ubuntu26.04列为支持系统](https://docs.docker.com/engine/install/ubuntu/)。本项目安装器现已允许26.04，Docker源使用系统实际代号；**尚未完成26.04全新虚拟机整机安装实测**。已验证的范围为安装器回归、真实dsh全新profile启动及既有Linux环境上的Docker/systemd配置。SnowLuma在官方Docker镜像中运行，宿主机不另装QQ或Node来运行它。

固定应用组合：Node24.22.1、pnpm11.28.5、dsh0.2.1-rc.2、插件1.4.3；SnowLuma使用官方`motricseven7/snowluma:latest`。镜像latest会随官方更新，不能理解为永久固定的版本。

## 1. 理解安装位置与访问端口

![部署结构与端口](images/deployment.svg)

所有终端命令使用**Ubuntu管理员账号的Bash终端**执行，需要权限的命令带`sudo`。Docker由系统管理；dsh使用单独的普通账号`dsh`运行，不必把该账号加入sudo或docker组。`sudo`执行的安装命令本身具有root权限，不影响系统软件的安装位置。

本教程沿用下面的路径和端口。代码中的`YOUR_PUBLIC_HOST`、`YOUR_LOCAL_IPV4`、`YOUR_OWNER_QQ`、`YOUR_ONEBOT_TOKEN`必须替换为自己的值；不要原样保留。

| 项目 | 本教程值 | 用途 |
| --- | --- | --- |
| dsh业务账号 | dsh，主目录/home/dsh | 运行dsh，无需设置SSH密码 |
| Docker部署目录 | /opt/dsh-snowluma-companion | Compose和VNC密码 |
| dsh网页 | 3080 | 浏览器使用带Token的登录链接 |
| SnowLuma管理页 | 5099 | 管理协议、网络端点和密码 |
| QQ远程桌面 | 6081 | 浏览器扫码登录QQ |
| dsh反向WS | 6199 | 容器向宿主机连接/ws |
| OneBot HTTP / 正向WS | 3000 / 3001 | 官方默认接口，本插件接入不使用 |

5099/6081以及官方OneBot端口沿用Compose的全部IPv4接口映射。公网访问还需要云服务器安全组和宿主网络允许相应端口；本教程不自动修改防火墙。6199只需容器到宿主可达，无需为此向公网放行。3080监听服务器实际拥有的具体IPv4，云服务器通常填内网IP；公网IP通过云厂商映射访问。

## 2. 安装系统依赖和Docker

先检查是否已有Docker。已有可用Docker Engine及Compose插件时，跳过下面的Docker安装段，不重复卸载或覆盖。发现`docker.io`、`podman-docker`等冲突包时，按[Docker官方文档](https://docs.docker.com/engine/install/ubuntu/#uninstall-old-versions)处理后继续。

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl xz-utils git ffmpeg build-essential pkg-config python3 nano
# 已有Docker时先执行检查：sudo docker version && sudo docker compose version
```

没有Docker时，配置官方APT源。这里从系统读取jammy/noble/resolute，不把26.04错误地写成24.04源。

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
printf 'Types: deb\nURIs: https://download.docker.com/linux/ubuntu\nSuites: %s\nComponents: stable\nArchitectures: %s\nSigned-By: /etc/apt/keyrings/docker.asc\n' \
  "${UBUNTU_CODENAME:-$VERSION_CODENAME}" "$(dpkg --print-architecture)" \
  | sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker compose version
```

## 3. 创建业务账号并安装Node和dsh

以下步骤使用`/home/dsh`。如果该账号或目录已用于其他部署，先停下来核对现有环境，不要直接覆盖。

```bash
sudo useradd --create-home --shell /bin/bash dsh
sudo install -d -o dsh -g dsh /home/dsh/.local/node /home/dsh/.local/dsh
sudo -iu dsh bash
```

进入**dsh账号的Bash**后，逐段执行。本步骤下载Node并校验官方SHA256；不使用Ubuntu仓库里可能不同版本的Node。

```bash
set -e
case "$(uname -m)" in
  x86_64) NODE_ARCH=x64 ;;
  aarch64|arm64) NODE_ARCH=arm64 ;;
  *) echo '只支持amd64或arm64'; exit 1 ;;
esac
NODE_ARCHIVE="node-v24.22.1-linux-${NODE_ARCH}.tar.xz"
NODE_DOWNLOAD_DIR="$(mktemp -d)"
cd "$NODE_DOWNLOAD_DIR"
curl -fSLO "https://nodejs.org/dist/v24.22.1/$NODE_ARCHIVE"
curl -fSLO https://nodejs.org/dist/v24.22.1/SHASUMS256.txt
awk -v file="$NODE_ARCHIVE" '$2 == file {print}' SHASUMS256.txt > node.sha256
test -s node.sha256
sha256sum -c node.sha256
tar -xJf "$NODE_ARCHIVE" -C /home/dsh/.local/node --strip-components=1
export PATH="/home/dsh/.local/node/bin:$PATH"
node --version
cd /home/dsh/.local/dsh
printf '{"name":"dsh-companion-runtime","private":true}\n' > package.json
npx --yes pnpm@11.28.5 add @deepseek-ai/dsh@0.2.1-rc.2 --dangerously-allow-all-builds
```

## 4. 安装统一插件和web profile

仍在**dsh账号**下执行。下载发行包并用GitHub返回的资产摘要校验，不执行下载的安装脚本。

```bash
mkdir -p /home/dsh/.dsh/packages /home/dsh/.dsh/profiles/web /home/dsh/.dsh/workspace
cd /home/dsh/.dsh/packages
curl -fsSL https://api.github.com/repos/Geng-zy/dsh-snowluma-companion/releases/tags/v1.4.3 -o release.json
python3 - <<'PY'
import hashlib, json, urllib.request
from pathlib import Path
name = 'dsh-snowluma-companion-1.4.3.tgz'
asset = next(a for a in json.loads(Path('release.json').read_text())['assets'] if a['name'] == name)
digest = asset.get('digest', '')
assert digest.startswith('sha256:') and len(digest) == 71, '发行包摘要缺失'
with urllib.request.urlopen(asset['browser_download_url'], timeout=60) as response:
    data = response.read()
assert hashlib.sha256(data).hexdigest() == digest[7:], '发行包校验失败'
Path(name).write_bytes(data)
PY
cd /home/dsh/.dsh/profiles/web
cat > package.json <<'JSON'
{
  "name": "dsh-profile-web",
  "private": true,
  "dsh": {"profile": {"bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-snowluma-companion"]}},
  "dependencies": {"dsh-snowluma-companion": "file:/home/dsh/.dsh/packages/dsh-snowluma-companion-1.4.3.tgz"}
}
JSON
cat > pnpm-workspace.yaml <<'YAML'
packages:
  - .
nodeLinker: hoisted
autoInstallPeers: false
YAML
npx --yes pnpm@11.28.5 install --ignore-scripts
```

使用`nano /home/dsh/.dsh/profiles/web/cordis.patch.yml`新建下面的配置，**替换主人QQ和Token**。JSON也是合法YAML，使用此形式可以避免缩进差异。Token自行生成至少16位可见字符，也可在当前终端执行`python3 -c 'import secrets; print(secrets.token_urlsafe(32))'`生成。

```json
[
  {"id":"snowluma-bridge","config":{
    "ws_reverse_host":"0.0.0.0","ws_reverse_port":6199,
    "ws_reverse_token":"YOUR_ONEBOT_TOKEN","admins":["YOUR_OWNER_QQ"],
    "workspacePath":"/home/dsh/.dsh/workspace","agentPreset":"companion",
    "privateModel":"deepseek-official/deepseek-flash",
    "groupModel":"deepseek-official/deepseek-flash",
    "adminPrivateModel":"deepseek-official/deepseek-flash"
  }},
  {"id":"agent-default-model","config":{"provider":"deepseek-official","model":"deepseek-flash"}},
  {"id":"llm-deepseek","config":{
    "baseURL":"https://api.deepseek.com/anthropic",
    "models":[{"id":"deepseek-flash","name":"deepseek-flash","inputModalities":["text","image"]}]
  }}
]
```

如果使用其他Messages兼容接口或模型，同时修改baseURL、models及三个会话模型选择，保持提供商/模型ID一致。API Key在下一步写入私密环境文件，不写进公开配置示例。

```bash
mkdir -p /home/dsh/.config/dsh-companion
chmod 700 /home/dsh/.config/dsh-companion
umask 077
cat > /home/dsh/.config/dsh-companion/runtime.env <<'ENV'
PATH="/home/dsh/.local/node/bin:/home/dsh/.local/dsh/node_modules/.bin:/usr/local/bin:/usr/bin:/bin"
DEEPSEEK_API_KEY=""
DEEPSEEK_BASE_URL="https://api.deepseek.com/anthropic"
ENV
nano /home/dsh/.config/dsh-companion/runtime.env
chmod 600 /home/dsh/.config/dsh-companion/runtime.env /home/dsh/.dsh/profiles/web/cordis.patch.yml
exit
```

在nano中把API Key填到空引号内。该文件遵循systemd EnvironmentFile语法，双引号值中的`\`和`"`需要转义，`$`保持原样。也可以留空，在dsh模型设置里填写。`exit`后返回原来的Ubuntu管理员终端。

## 5. 创建并启动dsh系统服务

先执行`ip -4 addr`查看本机IPv4，再用`sudo nano /etc/systemd/system/dsh.service`创建以下文件。**YOUR_LOCAL_IPV4填本机具体地址，YOUR_PUBLIC_HOST填浏览器访问的公网IP或域名**；都不带协议和端口。

```ini
[Unit]
Description=DSH SnowLuma Companion
After=network-online.target
Wants=network-online.target

[Service]
User=dsh
WorkingDirectory=/home/dsh
EnvironmentFile=/home/dsh/.config/dsh-companion/runtime.env
ExecStart=/home/dsh/.local/node/bin/node /home/dsh/.local/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js web --host YOUR_LOCAL_IPV4 --port 3080 --no-open --public-url http://YOUR_PUBLIC_HOST:3080/ --trusted-host YOUR_PUBLIC_HOST:3080
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemd-analyze verify /etc/systemd/system/dsh.service
sudo systemctl daemon-reload
sudo systemctl enable --now dsh
sudo systemctl status dsh --no-pager
sudo journalctl -u dsh -n 100 --no-pager -o cat
```

日志中的`dsh web: http://.../?token=...`是浏览器登录入口。dsh没有额外的用户名/密码；进程重启后Token可能更换，重新从日志取最新链接。`--public-url`与`--trusted-host`使公网地址符合dsh的访问校验，不要省略后再直接改URL访问。

## 6. 部署官方SnowLuma

回到Ubuntu管理员终端，下载固定发行版本的Compose。该文件基于官方模板，只增加容器访问宿主所需的host-gateway；默认监听、端口、数据卷、启动方式和QQ参数均沿用官方。

```bash
sudo install -d -m 700 /opt/dsh-snowluma-companion
sudo curl -fsSL https://raw.githubusercontent.com/Geng-zy/dsh-snowluma-companion/v1.4.3/deploy/snowluma.compose.yml \
  -o /opt/dsh-snowluma-companion/snowluma.compose.yml
sudo chmod 600 /opt/dsh-snowluma-companion/snowluma.compose.yml
sudo nano /opt/dsh-snowluma-companion/.env
```

在`.env`中写入下列内容，并**把VNC密码替换成自己的8个可见ASCII字符**。Compose的env文件单引号内容保持字面值，所以密码带`$`时也不会插值；此示例密码不要包含单引号。传统VNC只使用前8字节，填写更长密码不能提高有效长度。

```dotenv
SNOWLUMA_IMAGE=motricseven7/snowluma:latest
SNOWLUMA_WEBUI_HOST_PORT=5099
NOVNC_PORT=6081
ONEBOT_HTTP_PORT=3000
ONEBOT_WS_PORT=3001
VNC_PASSWD='8CHARS!!'
```

```bash
sudo chmod 600 /opt/dsh-snowluma-companion/.env
sudo docker compose --env-file /opt/dsh-snowluma-companion/.env \
  -f /opt/dsh-snowluma-companion/snowluma.compose.yml config -q
sudo docker compose --env-file /opt/dsh-snowluma-companion/.env \
  -f /opt/dsh-snowluma-companion/snowluma.compose.yml up -d
sudo docker ps --filter name=snowluma
```

手动教程采用官方首次管理流程：打开`http://YOUR_PUBLIC_HOST:5099/`，根据页面完成协议确认、初始化或修改管理密码。首次凭证按当前镜像的启动提示获取：`sudo docker logs snowluma 2>&1 | grep -E "临时密码|initial credentials" | tail -n 1`。不要把管理密码、日志中的首次凭证或VNC密码发到公开issue。

然后打开`http://YOUR_PUBLIC_HOST:6081/vnc.html`，连接并输入刚才设置的VNC密码，在QQ窗口扫码登录。改换QQ账号也从这个页面操作，无需重新安装或找人重建环境。QQ掉线要求重新扫码时按页面操作；不要删除数据卷来解决登录问题。

## 7. 添加反向WS并设置权限

在SnowLuma管理页的**OneBot网络配置**中新增一个反向WebSocket客户端：

| 字段 | 填写值 |
| --- | --- |
| 名称 | dsh |
| URL | ws://host.docker.internal:6199/ws |
| 角色 | Universal |
| Access Token | 与步骤4中的ws_reverse_token完全一致 |
| 消息格式 | array |
| 自身消息上报 | 关闭 |
| 重连间隔 | 3000毫秒 |

保存并按页面提示应用。官方默认的HTTP API和正向WS可保留，它们不是本插件创建的反向连接，也不需要再增加第二个dsh反向客户端。

打开dsh登录链接，进入**更多 → 设置 → SnowLuma陪伴助手 → 连接与权限**，展开“连接”和“访问控制”，核对6199端口、主人QQ与白名单。主人在私聊中具有管理权限；普通私聊和群聊分别由各自白名单约束，群内管理员发言也不能绕过群白名单与存档边界。

![插件设置：连接与权限](images/settings.png)

*截图来自隔离测试环境，展示真实插件界面；不含个人账号或生产凭据。折叠卡片点击右侧箭头展开。*

进入“运行概览”确认已建立QQ连接。聊天与回复、人格与核心记忆、主动聊天等设置分别位于左侧对应栏目。需要备份恢复时进入“备份与迁移”，导入`.tar.gz`后可查看识别出的文件，并多选本次需要恢复的类别。

![恢复预览支持多选](images/restore.png)

*恢复截图使用测试包；可选项目由包内实际内容决定，未勾选的类别保留当前内容。*

## 8. 核验与保存访问资料

| 要验证的内容 | 方法 |
| --- | --- |
| dsh运行 | sudo systemctl status dsh --no-pager |
| SnowLuma运行 | sudo docker ps --filter name=snowluma |
| 网页可用 | 浏览器访问3080登录链接、5099管理页、6081/vnc.html |
| QQ可用 | 远程桌面显示已登录，插件运行概览显示连接成功 |
| 接入一致 | 反向WS只配置一条，两端Token相同，主人QQ填的是你而非机器人 |
| 模型可用 | 模型设置中的URL、模型ID、API Key一致；最后按自己的需要发送一条测试消息 |

把下面的信息存入自己的密码管理器或权限为600的本地文件：

- dsh登录链接：步骤5日志中的最新地址；用户名/密码不适用。
- SnowLuma管理地址：`http://YOUR_PUBLIC_HOST:5099/`；密码为你在管理页设置的密码。
- QQ远程桌面：`http://YOUR_PUBLIC_HOST:6081/vnc.html`；密码为`.env`中的8字符密码。
- OneBot Token、主人QQ、模型API Key、业务账号`dsh`、上述部署及数据路径。
- Docker三个持久卷：`qq-gateway-data`、`qq-client-config`、`qq-client-data`；dsh数据位于`/home/dsh/.dsh`。

手动部署没有一键安装器的`installation-state.json`，不要使用`--resume`或`--show-info`来接管它。后续查网址使用本节记录和dsh日志即可。重启dsh使用`sudo systemctl restart dsh`；重启SnowLuma使用步骤6相同Compose参数的`restart`子命令。更新镜像前先备份现有数据。

## 下载或连接失败时

- **GitHub不可达**：在能访问GitHub的电脑从[发行页](https://github.com/Geng-zy/dsh-snowluma-companion/releases/tag/v1.4.3)下载`.tgz`，核对发行资产摘要后上传到`/home/dsh/.dsh/packages`并归属dsh账号；Compose文件也可以下载后上传。其余步骤相同。
- **Docker Hub不可达**：在可访问的同架构机器拉取官方镜像并`docker save`导出，上传后`sudo docker load -i 文件.tar`。不自动改镜像源或关闭TLS校验。
- **Node/npm/APT不可达**：仍需要可用的下载链路、缓存或可信软件源；上传插件与Docker镜像不等于整套离线安装。
- **公网拒绝连接**：先检查服务和服务器实际端口，再核对安全组。这里是5099/6081，不是曾经SSH转发使用的本机15099/16081。
- **反向WS没有连接**：核对容器host-gateway映射、dsh6199监听、Token、`/ws`路径及宿主防火墙；无需把dsh网页3080当成反向WS端口。

更多配置差异见[部署差异说明](DEPLOYMENT-DIFFERENCES.md)，一键方式见[一键安装说明](INSTALL.md)。
