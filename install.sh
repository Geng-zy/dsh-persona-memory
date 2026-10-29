#!/usr/bin/env bash
# Interactive server installation; user input is read from /dev/tty, including curl | sudo bash.
set -euo pipefail
umask 077
INSTALL_VERSION=1.4.2
INSTALLER_SHA256=b8a81636e65f1d5d3aa5c12136d327bde0e4ec3463a15a7af5b3fed391ffb160
if [[ "${1:-}" == --help || "${1:-}" == -h ]]; then
  cat <<'HELP'
SnowLuma Companion 一键安装（全新Ubuntu amd64/arm64，systemd）
运行：curl -fsSL https://raw.githubusercontent.com/Geng-zy/dsh-snowluma-companion/main/install.sh | sudo bash
可选参数请下载后运行：sudo bash install.sh --dry-run
中断续装：sudo python3 <部署目录>/install.py --resume <部署目录>
查看凭证：sudo python3 <部署目录>/install.py --show-info <部署目录>
本脚本不覆盖已有dsh服务、SnowLuma容器或登录卷。
HELP
  exit 0
fi
if [[ "$(uname -s)" != Linux || ! -d /run/systemd/system ]]; then
  echo '请在运行systemd的Ubuntu服务器上执行，不能在这台Mac上安装。' >&2; exit 1
fi
if [[ "$EUID" -ne 0 ]]; then
  echo '请使用 sudo bash install.sh，或 curl ... | sudo bash。' >&2; exit 1
fi
# Ubuntu minimal images may not have these bootstrap dependencies yet.
if ! command -v python3 >/dev/null || ! command -v curl >/dev/null; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y python3 curl ca-certificates
fi
installer_tmp="$(mktemp -d /tmp/dsh-companion-bootstrap.XXXXXX)"
cleanup() { python3 -c 'import shutil,sys; shutil.rmtree(sys.argv[1])' "$installer_tmp"; }
trap cleanup EXIT
curl --fail --show-error --silent --location --proto '=https' --tlsv1.2 \
  "https://raw.githubusercontent.com/Geng-zy/dsh-snowluma-companion/v${INSTALL_VERSION}/deploy/install.py" -o "$installer_tmp/install.py"
printf '%s  %s\n' "$INSTALLER_SHA256" "$installer_tmp/install.py" | sha256sum --check --status
python3 "$installer_tmp/install.py" "$@"
