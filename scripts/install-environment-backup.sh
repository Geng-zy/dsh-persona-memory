#!/usr/bin/env bash
# Ubuntu/systemd administrator setup. The JSON config is private and root-owned.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo 'Run as root.' >&2; exit 1; }
CONFIG=${1:?Usage: install-environment-backup.sh /private/config.json}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
python3 - "$CONFIG" <<'PY'
import json,os,stat,sys
from pathlib import Path
c=json.load(open(sys.argv[1]));base=Path(c['directory']);uid,gid=c['uid'],c['gid']
assert base.is_absolute() and str(base) != '/' and type(uid) is int and type(gid) is int
assert not base.is_symlink()
base.mkdir(parents=True,exist_ok=True);os.chown(base,0,gid);base.chmod(0o750)
for name,owner,mode in [('inbox',uid,0o700),('archives',0,0o750)]:
 p=base/name;assert not p.is_symlink();p.mkdir(exist_ok=True);os.chown(p,owner,gid);p.chmod(mode)
p=base/'helper.json';p.write_text(json.dumps({'format':1}));os.chown(p,0,gid);p.chmod(0o640)
p=base/'inbox'/'schedule.json'
if not p.exists():
 p.write_text(json.dumps({'schedule':'off','time':'04:30','weekday':7,'keep':5,'timezone':'Asia/Shanghai'}));os.chown(p,uid,gid);p.chmod(0o600)
PY
install -m 600 "$CONFIG" /etc/dsh-environment-backup.json
install -d -m 755 /usr/local/libexec
install -m 755 "$ROOT/scripts/environment-backup.py" /usr/local/libexec/dsh-environment-backup.py
cat > /etc/systemd/system/dsh-environment-backup.service <<'UNIT'
[Unit]
Description=Private dsh and QQ environment backup
After=local-fs.target
[Service]
Type=oneshot
ExecStart=/usr/bin/python3 /usr/local/libexec/dsh-environment-backup.py tick
TimeoutStartSec=30min
UMask=0077
Nice=10
IOSchedulingClass=best-effort
IOSchedulingPriority=7
UNIT
cat > /etc/systemd/system/dsh-environment-backup.timer <<'UNIT'
[Unit]
Description=Check private environment backup queue and schedule
[Timer]
OnBootSec=90s
OnUnitInactiveSec=30s
AccuracySec=1s
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now dsh-environment-backup.timer
