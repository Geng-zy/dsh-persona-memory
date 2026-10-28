#!/usr/bin/env python3
"""Privileged cold snapshot worker. Configuration is root-owned; inbox only accepts a schedule or a create request.
Run from a systemd timer. Archives contain credentials and must never be published.
"""
import argparse
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import stat
import subprocess
import tarfile
import tempfile
import uuid
from zoneinfo import ZoneInfo

FORMAT = 'dsh-environment-backup-v1'


def read_json(path):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        if not stat.S_ISREG(os.fstat(fd).st_mode) or os.fstat(fd).st_size > 65536:
            raise ValueError('invalid control file')
        with os.fdopen(fd, 'r') as stream:
            fd = -1
            return json.load(stream)
    finally:
        if fd >= 0:
            os.close(fd)


def atomic(path, value, gid):
    path = Path(path)
    tmp = path.with_name('.' + path.name + '.' + uuid.uuid4().hex)
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o640)
    try:
        os.fchmod(fd, 0o640)  # systemd UMask=0077 must not hide status from the dsh group.
        if os.geteuid() == 0:
            os.fchown(fd, 0, gid)
        with os.fdopen(fd, 'w') as stream:
            fd = -1
            json.dump(value, stream, ensure_ascii=False)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(tmp, path)
    finally:
        if fd >= 0:
            os.close(fd)
        tmp.unlink(missing_ok=True)


def digest(path):
    h = hashlib.sha256()
    with open(path, 'rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def safe_name(name):
    import re
    return bool(re.fullmatch(r'environment-\d{8}-\d{6}-[a-f0-9]{8}\.tar\.gz', name))


def schedule(value):
    import re
    mode = value.get('schedule', 'off')
    clock = value.get('time', '04:30')
    if mode not in ('off', 'daily', 'weekly') or not isinstance(clock, str) or not re.fullmatch(r'([01]\d|2[0-3]):[0-5]\d', clock):
        raise ValueError('invalid schedule')
    keep, weekday = value.get('keep', 5), value.get('weekday', 7)
    if type(keep) is not int or not 1 <= keep <= 5 or type(weekday) is not int or not 1 <= weekday <= 7:
        raise ValueError('invalid retention or weekday')
    tz = value.get('timezone', 'Asia/Shanghai')
    ZoneInfo(tz)
    return dict(schedule=mode, time=clock, keep=keep, weekday=weekday, timezone=tz)


def due(s, previous, now):
    local = now.astimezone(ZoneInfo(s['timezone']))
    return (s['schedule'] != 'off' and previous != local.date().isoformat()
            and local.strftime('%H:%M') >= s['time']
            and (s['schedule'] == 'daily' or local.isoweekday() == s['weekday']))


def entries(root):
    for parent, dirs, files in os.walk(root, followlinks=False):
        for name in dirs + files:
            path = Path(parent) / name
            rel = path.relative_to(root).as_posix()
            if path.is_symlink():
                yield dict(path=rel, type='symlink', target=os.readlink(path))
            elif path.is_file():
                yield dict(path=rel, type='file', size=path.stat().st_size, sha256=digest(path))


def verify(file):
    with tarfile.open(file, 'r:gz') as tar:
        members = tar.getmembers()
        names = [m.name.removeprefix('./') for m in members]
        if len(set(names)) != len(names):
            raise ValueError('duplicate archive path')
        for m, name in zip(members, names):
            if PurePosixPath(name).is_absolute() or '..' in PurePosixPath(name).parts or (not m.isdir() and not m.isfile() and not m.issym()):
                raise ValueError('unsafe archive entry')
        by_name = dict(zip(names, members))
        manifest = json.load(tar.extractfile(by_name['manifest.json']))
        if manifest.get('format') != FORMAT:
            raise ValueError('not an environment backup')
        expected = {r['path']: r for r in manifest['files']}
        actual = {n: m for n, m in by_name.items() if not m.isdir() and n != 'manifest.json'}
        if actual.keys() != expected.keys():
            raise ValueError('archive inventory mismatch')
        for name, row in expected.items():
            m = actual[name]
            if row['type'] == 'symlink':
                if not m.issym() or m.linkname != row['target']:
                    raise ValueError('symlink mismatch')
            else:
                if not m.isfile() or m.size != row['size']:
                    raise ValueError('file size mismatch')
                h = hashlib.sha256()
                with tar.extractfile(m) as stream:
                    for block in iter(lambda: stream.read(1024 * 1024), b''):
                        h.update(block)
                if h.hexdigest() != row['sha256']:
                    raise ValueError('file checksum mismatch')
        # No file is allowed below a symbolic link, regardless of archive ordering.
        links = {n for n, m in actual.items() if m.issym()}
        for name in by_name:
            if any(str(p) in links for p in PurePosixPath(name).parents):
                raise ValueError('archive writes through a symlink')
        return manifest


def copy_source(src, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if os.uname().sysname == 'Linux':
        # Preserve owners, modes and symlinks; --reflink=auto accelerates supported filesystems.
        subprocess.run(['cp', '-a', '--reflink=auto', '--', str(src), str(dest)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    elif src.is_dir():
        shutil.copytree(src, dest, symlinks=True)
    else:
        shutil.copy2(src, dest, follow_symlinks=False)


def control(service, action):
    subprocess.run(['systemctl', action, service], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def active(service):
    return subprocess.run(['systemctl', 'is-active', '--quiet', service]).returncode == 0


def prune(directory, keep):
    files = sorted((p for p in Path(directory).iterdir() if safe_name(p.name) and p.is_file() and not p.is_symlink()), key=lambda p: (p.stat().st_mtime_ns, p.name), reverse=True)
    for p in files[keep:]:
        p.unlink()
        p.with_suffix(p.suffix + '.sha256').unlink(missing_ok=True)


def make_backup(config, s, previous, reason='manual'):
    base = Path(config['directory'])
    gid = config['gid']
    archive_dir = base / 'archives'
    now = dt.datetime.now(dt.timezone.utc)
    state = {**previous, 'phase': 'copying', 'startedAt': int(now.timestamp()*1000), 'error': None}
    def save(**extra):
        state.update(extra)
        atomic(base / 'status.json', state, gid)
    save()
    roots = [Path(p) for p in config['sources'] if Path(p).exists()]
    for p in config.get('required', []):
        if not Path(p).exists():
            raise ValueError('required backup source is missing: ' + p)
    if any(not p.is_absolute() or p == Path('/') or p.is_symlink() for p in roots):
        raise ValueError('source must be an absolute regular path')
    for p in roots:
        if base == p or base.is_relative_to(p):
            raise ValueError('backup directory cannot be inside a source')
    # Reserve space before taking services offline. du counts allocated source data.
    sizes = subprocess.check_output(['du', '-sk', *map(str, roots)], text=True)
    size = sum(int(line.split()[0])*1024 for line in sizes.splitlines())
    if shutil.disk_usage(base).free < size*2 + 512*1024*1024:
        raise ValueError('not enough free space for staging and archive')
    stage = Path(tempfile.mkdtemp(prefix='.staging-', dir=base))
    stage.chmod(0o700)
    was_active = [name for name in config.get('services', []) if active(name)]
    stopped = []
    save(resumeServices=was_active)
    try:
        try:
            for name in was_active:
                # Remember before stopping: even a failed stop may already have taken effect.
                stopped.append(name)
                control(name, 'stop')
            for src in roots:
                copy_source(src, stage / 'root' / str(src).lstrip('/'))
            for excluded in config.get('exclude', []):
                target = stage / 'root' / excluded.lstrip('/')
                if '..' in Path(excluded).parts or not target.resolve().is_relative_to(stage.resolve()):
                    raise ValueError('invalid exclusion')
                if target.is_dir() and not target.is_symlink():
                    shutil.rmtree(target)
                else:
                    target.unlink(missing_ok=True)
        finally:
            failures = []
            for name in reversed(stopped):
                try:
                    control(name, 'start')
                except Exception:
                    failures.append(name)
            if failures:
                raise RuntimeError('could not restart: ' + ','.join(failures))
        save(phase='packing', servicesRestored=True)
        manifest = dict(format=FORMAT, createdAt=int(now.timestamp()*1000), reason=reason,
                        sources=list(map(str, roots)), excluded=config.get('exclude', []),
                        services=was_active, containsCredentials=True, files=list(entries(stage)))
        (stage / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False), encoding='utf8')
        name = 'environment-' + now.astimezone(ZoneInfo(s['timezone'])).strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:8] + '.tar.gz'
        part = archive_dir / ('.' + name + '.part')
        try:
            # Hard links are stored as independent regular files for portable verification/restoration.
            with tarfile.open(part, 'w:gz', compresslevel=3) as tar:
                paths = [stage/'manifest.json', stage/'root']
                for parent, dirs, files in os.walk(stage/'root', followlinks=False):
                    paths.extend(Path(parent)/n for n in dirs+files)
                for path in paths:
                    tar.inodes.clear()
                    info = tar.gettarinfo(str(path), arcname=path.relative_to(stage).as_posix())
                    if info.isfile():
                        with open(path, 'rb') as stream:
                            tar.addfile(info, stream)
                    else:
                        tar.addfile(info)
            verify(part)
            part.chmod(0o640)
            if os.geteuid() == 0:
                os.chown(part, 0, gid)
            path = archive_dir / name
            os.replace(part, path)
            checksum = digest(path)
            checksum_path = path.with_suffix(path.suffix + '.sha256')
            checksum_path.write_text(checksum + '  ' + name + '\n')
            checksum_path.chmod(0o640)
            if os.geteuid() == 0:
                os.chown(checksum_path, 0, gid)
            prune(archive_dir, s['keep'])
            backups = []
            for f in sorted(archive_dir.iterdir(), key=lambda p: p.stat().st_mtime_ns, reverse=True):
                if safe_name(f.name) and f.is_file() and not f.is_symlink():
                    backups.append(dict(name=f.name, size=f.stat().st_size, sha256=f.with_suffix(f.suffix+'.sha256').read_text().split()[0], createdAt=int(f.stat().st_mtime*1000)))
            save(phase='done', finishedAt=int(dt.datetime.now().timestamp()*1000), backups=backups, lastSuccess=int(now.timestamp()*1000), schedule=s)
            return path
        finally:
            part.unlink(missing_ok=True)
    finally:
        shutil.rmtree(stage)


def tick(config):
    base = Path(config['directory'])
    s = schedule(read_json(base / 'inbox' / 'schedule.json'))
    old = read_json(base / 'status.json') if (base / 'status.json').exists() else {}
    request = base / 'inbox' / 'request.json'
    if old.get('phase') == 'copying':
        for name in old.get('resumeServices', []):
            if name in config.get('services', []):
                control(name, 'start')
        old.update(phase='failed', error='previous backup was interrupted; services recovered')
        atomic(base/'status.json', old, config['gid'])
    elif old.get('phase') == 'packing':
        old.update(phase='failed', error='previous archive compression was interrupted')
        atomic(base/'status.json', old, config['gid'])
    manual = request.exists()
    if manual:
        read_json(request)  # Enforce bounded regular JSON; no command or path comes from the request.
        request.unlink()
    now = dt.datetime.now(dt.timezone.utc)
    scheduled = due(s, old.get('lastScheduledDay'), now)
    if not manual and not scheduled:
        if old.get('schedule') != s:
            atomic(base / 'status.json', {**old, 'schedule': s}, config['gid'])
        return
    if scheduled:
        old['lastScheduledDay'] = now.astimezone(ZoneInfo(s['timezone'])).date().isoformat()
    try:
        make_backup(config, s, old, 'manual' if manual else 'auto')
    except Exception as e:
        current = read_json(base/'status.json') if (base/'status.json').exists() else old
        atomic(base/'status.json', {**current, 'phase': 'failed', 'error': str(e)[:240], 'finishedAt': int(now.timestamp()*1000), 'schedule': s}, config['gid'])
        raise



def restore(file, target_root, apply=False):
    manifest = verify(file)
    target_root = Path(target_root).resolve()
    sources = [Path(s) for s in manifest['sources']]
    if any(not p.is_absolute() or p == Path('/') or '..' in p.parts for p in sources):
        raise ValueError('invalid restore sources')
    print(json.dumps({'verified': True, 'apply': apply, 'sources': list(map(str, sources))}, ensure_ascii=False))
    if not apply:
        return
    if target_root == Path('/') and os.geteuid() != 0:
        raise ValueError('restoring the server requires root')
    stage = Path(tempfile.mkdtemp(prefix='.dsh-restore-', dir=target_root))
    moved = []
    states = []
    try:
        # Extract regular entries first and symlinks last, after verify has rejected link ancestors.
        with tarfile.open(file, 'r:gz') as tar:
            members = sorted(tar.getmembers(), key=lambda m: m.issym())
            for m in members:
                name = m.name.removeprefix('./')
                if name in ('manifest.json', 'root'):
                    continue
                if not name.startswith('root/') and name != 'root':
                    raise ValueError('unexpected restore entry')
                rel = PurePosixPath(name).relative_to('root')
                if not any((Path('/')/str(rel)).is_relative_to(p) or p.is_relative_to(Path('/')/str(rel)) for p in sources):
                    raise ValueError('entry is outside declared restore sources')
                out = stage / str(rel)
                out.parent.mkdir(parents=True, exist_ok=True)
                if m.isdir():
                    out.mkdir(exist_ok=True)
                elif m.issym():
                    out.symlink_to(m.linkname)
                else:
                    with tar.extractfile(m) as src, open(out, 'xb') as dst:
                        shutil.copyfileobj(src, dst)
                if os.geteuid() == 0:
                    os.chown(out, m.uid, m.gid, follow_symlinks=False)
                if not m.issym():
                    out.chmod(m.mode)
            # Directory timestamps after child extraction.
            for m in reversed(members):
                if not m.issym() and m.name not in ('manifest.json', 'root'):
                    out = stage / str(PurePosixPath(m.name.removeprefix('./')).relative_to('root'))
                    os.utime(out, (m.mtime, m.mtime))
        services = manifest.get('services', []) if target_root == Path('/') else []
        states = [s for s in services if active(s)]
        try:
            for s in states:
                control(s, 'stop')
            for source in sources:
                rel = str(source).lstrip('/')
                src, dest = stage/rel, target_root/rel
                if not src.exists() and not src.is_symlink():
                    continue
                dest.parent.mkdir(parents=True, exist_ok=True)
                # Refuse unexpected symlink parents on the destination server.
                if not dest.parent.resolve().is_relative_to(target_root):
                    raise ValueError('destination escapes restore root')
                aside = dest.with_name(dest.name+'.before-restore-'+uuid.uuid4().hex[:8])
                if dest.exists() or dest.is_symlink():
                    dest.rename(aside)
                moved.append((dest, aside))
                src.rename(dest)
        except Exception:
            for dest, aside in reversed(moved):
                if dest.is_dir() and not dest.is_symlink():
                    shutil.rmtree(dest)
                else:
                    dest.unlink(missing_ok=True)
                if aside.exists() or aside.is_symlink():
                    aside.rename(dest)
            raise
        finally:
            if services:
                subprocess.run(['systemctl', 'daemon-reload'], check=True)
            for s in reversed(states):
                control(s, 'start')
    finally:
        shutil.rmtree(stage)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['tick', 'verify', 'restore'])
    parser.add_argument('--config', default='/etc/dsh-environment-backup.json')
    parser.add_argument('--archive')
    parser.add_argument('--target-root', default='/')
    parser.add_argument('--apply', action='store_true', help='actually restore; default only verifies and prints the plan')
    args = parser.parse_args()
    if args.command == 'restore':
        restore(args.archive, args.target_root, args.apply)
        return
    if args.command == 'verify':
        m = verify(args.archive)
        print(json.dumps({'verified': True, 'files': len(m['files']), 'containsCredentials': True}))
        return
    config = read_json(args.config)
    with open(Path(config['directory']) / '.lock', 'a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        # The exclusive worker lock ensures no live job owns these abandoned staging files.
        base = Path(config['directory'])
        for old in base.glob('.staging-*'):
            if old.is_dir() and not old.is_symlink():
                shutil.rmtree(old)
        for old in (base/'archives').glob('.environment-*.part'):
            if old.is_file() and not old.is_symlink():
                old.unlink()
        tick(config)


if __name__ == '__main__':
    main()
