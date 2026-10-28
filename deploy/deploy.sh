#!/usr/bin/env bash
# 一键部署（在你自己的电脑上跑，Mac / Linux）：先在本机把要用的东西都下好（两个插件的最新版、SnowLuma 和它的安装脚本），
# 核对校验值后传到服务器，再在服务器上运行 install-server.sh。适合连不上 GitHub 的国内服务器。
#
# 用法：
#   deploy/deploy.sh <用户@服务器> --admin <主人 QQ> [install-server.sh 的其他选项]
# 例子：
#   deploy/deploy.sh ubuntu@1.2.3.4 --admin 12345678 --bot-qq 87654321
#   deploy/deploy.sh ubuntu@1.2.3.4 -i ~/.ssh/my_key --admin 12345678
# 选项：
#   -i KEY      SSH 私钥（不给就用 ssh 默认的）
#   其余选项原样交给 install-server.sh（--help 看它的说明）
# 需要：本机有 curl、python3、ssh、scp；服务器上的用户能 sudo。
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
[ $# -ge 1 ] || { sed -n '2,13p' "$0"; exit 1; }
TARGET="$1"; shift
SSH_OPTS=()
PASS=()
while [ $# -gt 0 ]; do
  case "$1" in
    -i) SSH_OPTS+=(-i "$2"); shift 2 ;;
    *) PASS+=("$1"); shift ;;
  esac
done
for c in curl python3 ssh scp; do command -v "$c" >/dev/null || { echo "本机缺少 $c" >&2; exit 1; }; done

BUNDLE="$(mktemp -d)"
trap 'rm -rf "$BUNDLE"' EXIT
sha256() { if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }

# 从 GitHub Release 下一个文件，用 GitHub 给的 SHA-256 核对
fetch_release() { # 仓库 文件名的正则 存成的名字（空=原名）
  local json name url digest
  json="$(curl -fsSL "https://api.github.com/repos/$1/releases/latest")"
  read -r name url digest < <(printf '%s' "$json" | python3 -c '
import json, re, sys
pat = re.compile(sys.argv[1])
for a in json.load(sys.stdin)["assets"]:
    if pat.search(a["name"]):
        print(a["name"], a["browser_download_url"], (a.get("digest") or "").replace("sha256:", "")); break
' "$2")
  [ -n "${url:-}" ] || { echo "在 $1 的最新版里没找到 $2" >&2; exit 1; }
  local out="$BUNDLE/${3:-$name}"
  curl -fsSL -o "$out" "$url"
  if [ -n "${digest:-}" ]; then
    [ "$(sha256 "$out")" = "$digest" ] || { echo "$name 校验值不对" >&2; exit 1; }
    echo "   $name（SHA-256 已核对）"
  else
    echo "   $name（GitHub 没给校验值）"
  fi
}

echo "== 在本机下载"
fetch_release Geng-zy/dsh-snowluma-bridge '\.tgz$' ""
fetch_release Geng-zy/dsh-companion-core '\.tgz$' ""
if [[ " ${PASS[*]:-} " != *" --no-snowluma "* ]]; then
  fetch_release NapNeko/SnowLumaQQ '^SnowLuma\.Shell\.zip$' ""
  curl -fsSL -o "$BUNDLE/snowluma-install.sh" https://raw.githubusercontent.com/NapNeko/SnowLuma-Installer/main/script/install.sh
  echo "   SnowLuma 安装脚本（SnowLuma-Installer main 分支，sha256 $(sha256 "$BUNDLE/snowluma-install.sh" | cut -c1-16)…）"
fi
cp "$HERE/install-server.sh" "$BUNDLE/"

echo "== 传到 $TARGET"
REMOTE="dsh-deploy-bundle"
ssh "${SSH_OPTS[@]}" "$TARGET" "rm -rf ~/$REMOTE && mkdir -p ~/$REMOTE"
scp -q "${SSH_OPTS[@]}" "$BUNDLE"/* "$TARGET:$REMOTE/"

echo "== 在服务器上安装"
QUOTED=""
for a in "${PASS[@]:-}"; do [ -n "$a" ] && QUOTED="$QUOTED $(printf '%q' "$a")"; done
ssh -t "${SSH_OPTS[@]}" "$TARGET" "bash ~/$REMOTE/install-server.sh --bundle ~/$REMOTE$QUOTED && rm -rf ~/$REMOTE"
