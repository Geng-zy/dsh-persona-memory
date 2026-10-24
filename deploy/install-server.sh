#!/usr/bin/env bash
# 一键部署（在服务器上跑）：从一台刚装好的 Ubuntu 开始，装好 dsh + 两个插件（dsh-napcat-bridge、dsh-companion-core）+ NapCat，
# 两边的连接 Token 自动生成并配好（不打印），做成开机自启的服务。跑完只剩：扫码登录 QQ 小号、在网页里填 DeepSeek Key。
#
# 用法（用有 sudo 的普通用户跑，比如腾讯云的 ubuntu；不要用 root 直接跑）：
#   bash install-server.sh --admin <主人 QQ> [选项]
# 选项：
#   --admin QQ            主人的 QQ 号（必填，可以多个，用逗号分开）
#   --bot-qq QQ           机器人小号的 QQ 号（填了 NapCat 会用它快速登录，不填就每次扫码）
#   --public-host HOST    浏览器访问 dsh 网页用的地址（公网 IP 或域名，不带端口）；不填就自动查公网 IP，查不到就只能走 SSH 隧道
#   --bind-ip IP          dsh 网页绑哪个网卡地址（默认自动取内网 IP；dsh 不接受 0.0.0.0）
#   --web-port PORT       dsh 网页端口（默认 3080）
#   --ws-port PORT        插件一给 NapCat 连的端口（默认 6199，只在本机用，不用放行）
#   --dsh-user NAME       跑 dsh 的用户（默认 dafeiyu，没有 sudo）
#   --bundle DIR          离线安装包目录（deploy.sh 准备的：两个插件的 .tgz、NapCat.Shell.zip、NapCat 的 install.sh）；
#                         不给就从 GitHub 下（服务器连不上 GitHub 时一定要给）
#   --no-napcat           不装 NapCat（已经有了，或者 NapCat 装在别的机器）
#   --node-version V      Node 版本（默认 24.22.1）
#   --dsh-version V       dsh 版本（默认 0.2.1-rc.2）
#   --node-mirror URL     Node 下载镜像（默认 https://npmmirror.com/mirrors/node）
#   --npm-registry URL    npm 源（默认 https://registry.npmmirror.com/）
#
# 可以重复跑：装过的会跳过；已有的配置不覆盖（连接 Token 不会被换掉）。
set -euo pipefail

ADMIN="" BOT_QQ="" PUBLIC_HOST="" BIND_IP="" WEB_PORT=3080 WS_PORT=6199 DSH_USER=dafeiyu BUNDLE="" WITH_NAPCAT=1
NODE_VERSION=24.22.1 DSH_VERSION=0.2.1-rc.2 PNPM_VERSION=11.28.5
NODE_MIRROR=https://npmmirror.com/mirrors/node NPM_REGISTRY=https://registry.npmmirror.com/
GH_PLUGINS=("Geng-zy/dsh-napcat-bridge" "Geng-zy/dsh-companion-core")

while [ $# -gt 0 ]; do
  case "$1" in
    --admin) ADMIN="$2"; shift 2 ;;
    --bot-qq) BOT_QQ="$2"; shift 2 ;;
    --public-host) PUBLIC_HOST="$2"; shift 2 ;;
    --bind-ip) BIND_IP="$2"; shift 2 ;;
    --web-port) WEB_PORT="$2"; shift 2 ;;
    --ws-port) WS_PORT="$2"; shift 2 ;;
    --dsh-user) DSH_USER="$2"; shift 2 ;;
    --bundle) BUNDLE="$(cd "$2" && pwd)"; shift 2 ;;
    --no-napcat) WITH_NAPCAT=0; shift ;;
    --node-version) NODE_VERSION="$2"; shift 2 ;;
    --dsh-version) DSH_VERSION="$2"; shift 2 ;;
    --node-mirror) NODE_MIRROR="${2%/}"; shift 2 ;;
    --npm-registry) NPM_REGISTRY="$2"; shift 2 ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) echo "不认识的参数：$1（--help 看用法）" >&2; exit 1 ;;
  esac
done

step() { printf '\n\033[1;32m== %s\033[0m\n' "$*"; }
note() { printf '   %s\n' "$*"; }
die() { printf '\033[1;31m错误：%s\033[0m\n' "$*" >&2; exit 1; }

[ -n "$ADMIN" ] || die "要用 --admin 告诉我主人的 QQ 号"
[[ "$ADMIN" =~ ^[0-9]+(,[0-9]+)*$ ]] || die "--admin 只能是 QQ 号（多个用逗号分开）"
[ -z "$BOT_QQ" ] || [[ "$BOT_QQ" =~ ^[0-9]+$ ]] || die "--bot-qq 只能是 QQ 号"
[ "$(id -u)" -ne 0 ] || die "请用有 sudo 的普通用户跑（NapCat 会装在这个用户下），不要直接用 root"
sudo -v || die "这个用户没有 sudo"
. /etc/os-release
[ "${ID:-}" = ubuntu ] || [ "${ID_LIKE:-}" = debian ] || [ "${ID:-}" = debian ] || die "只在 Ubuntu / Debian 上测过（这台是 ${PRETTY_NAME:-未知}）"
case "$(uname -m)" in
  x86_64|amd64) NODE_ARCH=x64 ;;
  aarch64|arm64) NODE_ARCH=arm64 ;;
  *) die "不支持的架构：$(uname -m)" ;;
esac
ME="$(id -un)"
ME_HOME="$(getent passwd "$ME" | cut -d: -f6)"
DSH_HOME_DIR="/home/$DSH_USER"
as_dsh() { sudo -u "$DSH_USER" -H env PATH="$DSH_HOME_DIR/.local/node/bin:$DSH_HOME_DIR/.local/dsh/node_modules/.bin:/usr/local/bin:/usr/bin:/bin" bash -c "$1"; }

step "1/8 系统软件（ffmpeg、curl、openssl 等）"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ffmpeg curl ca-certificates xz-utils openssl python3 >/dev/null
note "ffmpeg：$(command -v ffmpeg)"

step "2/8 用户 $DSH_USER（跑 dsh，没有 sudo）"
if id "$DSH_USER" >/dev/null 2>&1; then note "已经有了"
else
  sudo useradd -m -s /bin/bash "$DSH_USER"
  sudo passwd -l "$DSH_USER" >/dev/null
  sudo chmod 750 "$DSH_HOME_DIR"
  note "建好了（密码锁定，只能用 sudo -iu $DSH_USER 进去）"
fi

step "3/8 Node $NODE_VERSION 和 dsh $DSH_VERSION（装在 $DSH_USER 自己的目录里）"
if as_dsh "node --version 2>/dev/null" | grep -qx "v$NODE_VERSION"; then note "Node 已经装好"
else
  TMP="$(mktemp -d)"; NAME="node-v$NODE_VERSION-linux-$NODE_ARCH.tar.xz"
  curl -fsSL -o "$TMP/$NAME" "$NODE_MIRROR/v$NODE_VERSION/$NAME" || die "下载 Node 失败（$NODE_MIRROR）"
  curl -fsSL -o "$TMP/SHASUMS256.txt" "$NODE_MIRROR/v$NODE_VERSION/SHASUMS256.txt" || die "下载 Node 校验值失败"
  # 能连上 nodejs.org 时再用官方的校验值核对一次（镜像和官方对不上就停）
  if curl -fsSL -m 15 -o "$TMP/official.txt" "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt" 2>/dev/null; then
    cmp -s <(grep " $NAME\$" "$TMP/SHASUMS256.txt") <(grep " $NAME\$" "$TMP/official.txt") || die "镜像的 Node 校验值和 nodejs.org 的不一样"
  fi
  (cd "$TMP" && grep " $NAME\$" SHASUMS256.txt | sha256sum -c --quiet) || die "Node 安装包校验失败"
  chmod 755 "$TMP"; chmod 644 "$TMP/$NAME"
  as_dsh "rm -rf ~/.local/node && mkdir -p ~/.local/node && tar -xJf '$TMP/$NAME' -C ~/.local/node --strip-components=1"
  rm -rf "$TMP"
  note "Node $(as_dsh 'node --version')"
fi
as_dsh "npm config set registry '$NPM_REGISTRY' >/dev/null"
as_dsh "grep -q '.local/node/bin' ~/.profile 2>/dev/null || echo 'export PATH=\"\$HOME/.local/node/bin:\$HOME/.local/dsh/node_modules/.bin:\$PATH\"' >> ~/.profile"
as_dsh "command -v pnpm >/dev/null && [ \"\$(pnpm --version)\" = '$PNPM_VERSION' ] || npm install -g pnpm@$PNPM_VERSION >/dev/null 2>&1"
if [ "$(as_dsh 'dsh --version 2>/dev/null' || true)" = "$DSH_VERSION" ]; then note "dsh 已经装好"
else
  note "安装 dsh（几百个包，要几分钟）…"
  as_dsh "mkdir -p ~/.local/dsh && cd ~/.local/dsh && echo '{\"name\":\"dsh-local\",\"private\":true}' > package.json && pnpm add '@deepseek-ai/dsh@$DSH_VERSION' --dangerously-allow-all-builds >/dev/null"
  note "dsh $(as_dsh 'dsh --version')"
fi

step "4/8 两个插件"
PKGS="$DSH_HOME_DIR/pkgs"
sudo install -d -o "$DSH_USER" -g "$DSH_USER" -m 750 "$PKGS"
TMP="$(mktemp -d)"; chmod 755 "$TMP"
for repo in "${GH_PLUGINS[@]}"; do
  name="${repo#*/}"
  file=""
  if [ -n "$BUNDLE" ]; then file="$(ls -1 "$BUNDLE"/"$name"-*.tgz 2>/dev/null | sort -V | tail -1 || true)"; fi
  if [ -z "$file" ]; then
    note "从 GitHub 下 $name 的最新版…"
    url="$(curl -fsSL -m 30 "https://api.github.com/repos/$repo/releases/latest" | python3 -c 'import json,sys; print(next(a["browser_download_url"] for a in json.load(sys.stdin)["assets"] if a["name"].endswith(".tgz")))')" \
      || die "连不上 GitHub。请在自己电脑上用 deploy.sh（它会先下好再传上来），或者用 --bundle 指定装好包的目录"
    curl -fsSL -o "$TMP/${url##*/}" "$url" || die "下载 $name 失败"
    file="$TMP/${url##*/}"
  fi
  sudo install -o "$DSH_USER" -g "$DSH_USER" -m 640 "$file" "$PKGS/"
  note "$(basename "$file")"
done
rm -rf "$TMP"
NEW_PKGS="$(ls -1 "$PKGS" 2>/dev/null || sudo ls -1 "$PKGS")"
ARGS=""
for repo in "${GH_PLUGINS[@]}"; do
  name="${repo#*/}"; f="$(echo "$NEW_PKGS" | grep "^$name-.*\.tgz\$" | sort -V | tail -1)"
  ARGS="$ARGS ./pkgs/$f"
  # 旧版本的包删掉（profile 指向的是新的）
  for old in $(echo "$NEW_PKGS" | grep "^$name-.*\.tgz\$" | grep -vx "$f"); do sudo rm -f "$PKGS/$old"; done
done
as_dsh "cd ~ && dsh plugin --profile web add $ARGS" >/dev/null
note "已加进 dsh 的 web 配置（$DSH_HOME_DIR/.dsh/profiles/web）"

step "5/8 dsh 和插件一的配置"
if [ -z "$BIND_IP" ]; then BIND_IP="$(ip -4 route get 1.1.1.1 2>/dev/null | sed -n 's/.* src \([0-9.]*\).*/\1/p' | head -1)"; fi
[ -n "$BIND_IP" ] || die "取不到内网 IP，请用 --bind-ip 指定"
if [ -z "$PUBLIC_HOST" ]; then
  for u in https://ifconfig.me https://api.ipify.org https://ip.3322.net; do
    PUBLIC_HOST="$(curl -fsS4 -m 8 "$u" 2>/dev/null | tr -d '[:space:]' || true)"
    [[ "$PUBLIC_HOST" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] && break || PUBLIC_HOST=""
  done
fi
PATCH="$DSH_HOME_DIR/.dsh/profiles/web/cordis.patch.yml"
TOKEN_FILE="$(mktemp)"; chmod 600 "$TOKEN_FILE"
NEW_TOKEN=0
if sudo test -f "$PATCH" && sudo grep -q '^- id: napcat-bridge' "$PATCH"; then
  note "配置已经有了，不覆盖（$PATCH）"
else
  openssl rand -hex 32 > "$TOKEN_FILE"; NEW_TOKEN=1
  ADMINS="$(echo "$ADMIN" | sed "s/,/', '/g")"
  TRUSTED=""; [ -n "$PUBLIC_HOST" ] && TRUSTED="    trustedHosts: [ '$PUBLIC_HOST:$WEB_PORT' ]"
  NEW_PATCH="$(mktemp)"   # mktemp 建的文件只有自己能读（里面有 Token）
  {
    if sudo test -f "$PATCH"; then sudo cat "$PATCH"; fi
    cat <<EOF
# 下面几行是 install-server.sh 写的
- id: connection
  name: '@deepseek-ai/dsh-client-connection'
  config:
    cookieMaxAgeDays: 365
$TRUSTED
- id: napcat-bridge
  config:
    ws_reverse_port: $WS_PORT
    ws_reverse_token: $(cat "$TOKEN_FILE")
    admins: [ '$ADMINS' ]
    workspacePath: $DSH_HOME_DIR/workspace
EOF
  } > "$NEW_PATCH"
  sudo install -o "$DSH_USER" -g "$DSH_USER" -m 600 "$NEW_PATCH" "$PATCH"; rm -f "$NEW_PATCH"
  sudo install -d -o "$DSH_USER" -g "$DSH_USER" -m 750 "$DSH_HOME_DIR/workspace"
  note "写好了：登录记住 365 天、${PUBLIC_HOST:+信任 $PUBLIC_HOST:$WEB_PORT、}主人 $ADMIN、连接 Token（随机生成，不显示）"
fi

step "6/8 dsh 服务（开机自启，挂了自动重启）"
sudo tee /etc/systemd/system/dsh.service >/dev/null <<EOF
[Unit]
Description=DeepSeek Harness 网页（$DSH_USER 用户，带 dsh-napcat-bridge 和 dsh-companion-core）
After=network-online.target
Wants=network-online.target

[Service]
User=$DSH_USER
Group=$DSH_USER
WorkingDirectory=$DSH_HOME_DIR
Environment=PATH=$DSH_HOME_DIR/.local/node/bin:$DSH_HOME_DIR/.local/dsh/node_modules/.bin:/usr/local/bin:/usr/bin:/bin
# dsh 不接受 0.0.0.0，绑内网网卡地址；换了内网 IP 要改这里
ExecStart=$DSH_HOME_DIR/.local/dsh/node_modules/.bin/dsh web --host $BIND_IP --port $WEB_PORT --no-open
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable dsh >/dev/null 2>&1
sudo systemctl restart dsh
note "已启动：dsh web --host $BIND_IP --port $WEB_PORT"

if [ "$WITH_NAPCAT" = 1 ]; then
  step "7/8 NapCat（装在 $ME 下）"
  NC_DIR="$ME_HOME/Napcat"
  NC_CONF="$NC_DIR/opt/QQ/resources/app/app_launcher/napcat/config"
  if [ -x "$NC_DIR/opt/QQ/qq" ]; then note "已经装好"
  else
    mkdir -p "$ME_HOME/napcat-install"; cd "$ME_HOME/napcat-install"
    if [ -n "$BUNDLE" ] && [ -f "$BUNDLE/NapCat.Shell.zip" ]; then cp "$BUNDLE/NapCat.Shell.zip" .; fi
    if [ -n "$BUNDLE" ] && [ -f "$BUNDLE/napcat-install.sh" ]; then cp "$BUNDLE/napcat-install.sh" install.sh
    else curl -fsSL -o install.sh https://raw.githubusercontent.com/NapNeko/NapCat-Installer/main/script/install.sh || die "下载 NapCat 安装脚本失败（服务器连不上 GitHub 时用 deploy.sh）"
    fi
    note "运行 NapCat 官方安装脚本（不装 Docker 版和 TUI-CLI）…"
    bash install.sh --docker n --cli n --github-proxy 0 > install.log 2>&1 || { tail -20 install.log; die "NapCat 安装失败，日志在 $ME_HOME/napcat-install/install.log"; }
    rm -f NapCat.Shell.zip
    cd - >/dev/null
  fi
  mkdir -p "$NC_CONF"
  if [ "$NEW_TOKEN" = 1 ]; then
    # 连接配置：onebot11.json 是新账号的默认配置；填了小号 QQ 时它自己那份也写上
    for f in onebot11.json ${BOT_QQ:+onebot11_$BOT_QQ.json}; do
      python3 - "$NC_CONF/$f" "$WS_PORT" "$TOKEN_FILE" <<'PY'
import json, os, sys
path, port, token_file = sys.argv[1], sys.argv[2], sys.argv[3]
token = open(token_file).read().strip()
d = json.load(open(path)) if os.path.exists(path) else {}
net = d.setdefault('network', {})
for k in ('httpServers', 'httpSseServers', 'httpClients', 'websocketServers', 'websocketClients', 'plugins'):
    net.setdefault(k, [])
net['websocketClients'] = [c for c in net['websocketClients'] if c.get('name') != 'dsh-napcat-bridge'] + [{
    'name': 'dsh-napcat-bridge', 'enable': True, 'url': 'ws://127.0.0.1:%s/ws' % port, 'messagePostFormat': 'array',
    'reportSelfMessage': False, 'reconnectInterval': 5000, 'token': token, 'debug': False, 'heartInterval': 30000,
}]
d.setdefault('musicSignUrl', ''); d.setdefault('enableLocalFile2Url', False); d.setdefault('parseMultMsg', False)
tmp = path + '.tmp'
with open(os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), 'w') as fh:
    json.dump(d, fh, ensure_ascii=False, indent=2)
os.replace(tmp, path)
PY
    done
    note "NapCat 连接配置写好了（WebSocket 客户端 ws://127.0.0.1:$WS_PORT/ws，Token 和插件一一致）"
  else
    note "插件一的配置原来就有，NapCat 连接配置不动（要换 Token 就在插件一设置页「随机生成 Token」，再填进 NapCat）"
  fi
  sudo tee /etc/systemd/system/napcat.service >/dev/null <<EOF
[Unit]
Description=NapCat（QQ 小号，$ME 用户）
After=network-online.target
Wants=network-online.target

[Service]
User=$ME
Group=$(id -gn)
WorkingDirectory=$ME_HOME
ExecStart=/usr/bin/xvfb-run -a $NC_DIR/opt/QQ/qq --no-sandbox${BOT_QQ:+ -q $BOT_QQ}
Restart=always
RestartSec=10
MemoryMax=1500M

[Install]
WantedBy=multi-user.target
EOF
  sudo systemctl daemon-reload
  sudo systemctl enable napcat >/dev/null 2>&1
  sudo systemctl restart napcat
  note "已启动"
else
  step "7/8 NapCat：跳过（--no-napcat）"
  if [ "$NEW_TOKEN" = 1 ]; then note "NapCat 那边的 Token 要和插件一一致：到插件一设置页「随机生成 Token」重新生成一个，保存后填进 NapCat"; fi
fi
rm -f "$TOKEN_FILE"

step "8/8 检查"
sleep 8
systemctl is-active --quiet dsh && note "dsh：运行中" || note "dsh 没起来：sudo journalctl -u dsh -n 50"
LINK="$(sudo journalctl -u dsh -b --no-pager -o cat | grep -oE 'https?://[^ ]+\?token=[A-Za-z0-9_-]+' | tail -1 || true)"
[ -n "$PUBLIC_HOST" ] && LINK="$(printf '%s' "$LINK" | sed -E "s#^(https?://)[^/]+/#\1$PUBLIC_HOST:$WEB_PORT/#")"

cat <<EOF

全部装好了。还剩几步要你自己做：

1. 打开 dsh 网页（第一次要带 token 的链接，之后浏览器记住 365 天）：
   ${LINK:-（还没打印出来，过几秒运行：sudo journalctl -u dsh -b -o cat | grep token=）}
   ${PUBLIC_HOST:+云服务器安全组要放行 $WEB_PORT 端口（建议只放行自己的 IP）；}不想开端口就用 SSH 隧道：
   ssh -L $WEB_PORT:$BIND_IP:$WEB_PORT $ME@<服务器>，然后打开 http://localhost:$WEB_PORT/?token=…（上面链接里的 token）
2. 在网页的「设置 → 模型」里填 DeepSeek API Key。想用 DeepSeek 账号登录：dsh 只允许在 localhost 地址上登录账号，
   所以要先按上面的 SSH 隧道方式打开网页，再去登录。
EOF
if [ "$WITH_NAPCAT" = 1 ]; then cat <<EOF
3. 登录 QQ 小号：二维码在 $NC_DIR/opt/QQ/resources/app/app_launcher/napcat/cache/qrcode.png
   （或者打开 NapCat 网页 http://<服务器>:6099/webui/ 扫码，Token 在 $NC_CONF/webui.json，记得改掉）。
   扫完后插件一设置页的「测试连接」应该显示已连上。${BOT_QQ:+以后 NapCat 重启会用 $BOT_QQ 快速登录。}
EOF
fi
cat <<EOF
4. 其余设置（白名单、唤醒词、人格、向量 Key……）都在 dsh 网页「插件」里两个插件的设置页。
EOF
