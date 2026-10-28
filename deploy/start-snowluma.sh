#!/bin/bash
set -euo pipefail
# Keep authenticated reconnects from being refused by a stale VNC client.
# The upstream startup script and its authentication remain in use.
if ! grep -q '^x11vnc .* -alwaysshared ' /root/start.sh; then
  sed -i '/^x11vnc -display /s/ -forever / -forever -alwaysshared /' /root/start.sh
fi
grep -q '^x11vnc .* -alwaysshared ' /root/start.sh
exec /bin/bash /root/start.sh
