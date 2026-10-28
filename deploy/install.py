#!/usr/bin/env python3
"""Interactive fresh installation. Standard library only; never overwrite an existing deployment."""
import argparse
import hashlib
import ipaddress
import json
import os
import platform
import pwd
import re
import secrets
import shutil
import socket
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.error
import http.cookiejar
import urllib.parse
import urllib.request
from pathlib import Path

VERSION = '1.2.0'
DSH_VERSION = '0.2.1-rc.2'
NODE_VERSION = '24.22.1'
PNPM_VERSION = '11.28.5'
REPO = 'Geng-zy/dsh-snowluma-companion'
VOLUMES = ['qq-gateway-data', 'qq-client-config', 'qq-client-data']

class InstallError(Exception):
    pass

def run(args, *, cwd=None, env=None, capture=False):
    result = subprocess.run([str(x) for x in args], cwd=cwd, env=env,
                            stdout=subprocess.PIPE if capture else None,
                            stderr=subprocess.PIPE if capture else None, text=True)
    if result.returncode:
        # Do not echo command arguments, process output or configuration containing credentials.
        raise InstallError('执行失败：' + Path(str(args[0])).name + '；请检查上方安装输出或服务日志。')
    return result.stdout if capture else ''

def write_private(path, value, *, uid=None, gid=None, mode=0o600):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC | getattr(os, 'O_NOFOLLOW', 0)
    fd = os.open(path, flags, mode)
    with os.fdopen(fd, 'w', encoding='utf-8') as out:
        os.fchmod(out.fileno(), mode)
        if uid is not None:
            os.fchown(out.fileno(), uid, gid)
        out.write(value)

class Terminal:
    def __init__(self):
        try:
            self.stream = open('/dev/tty', 'r+', encoding='utf-8', buffering=1)
        except OSError:
            raise InstallError('需要交互终端；请通过SSH终端运行，不能在无终端任务中安装。')
    def ask(self, label, default=None, secret=False):
        import termios
        suffix = '（回车自动生成）' if secret and default == '__generate__' else (f' [{default}]' if default else '')
        self.stream.write(label + suffix + '：')
        saved = None
        if secret:
            saved = termios.tcgetattr(self.stream.fileno())
            changed = saved.copy(); changed[3] &= ~termios.ECHO
            termios.tcsetattr(self.stream.fileno(), termios.TCSADRAIN, changed)
        try:
            line = self.stream.readline()
            if not line:
                raise InstallError('输入已结束，安装取消。')
        finally:
            if saved is not None:
                termios.tcsetattr(self.stream.fileno(), termios.TCSADRAIN, saved)
                self.stream.write('\n')
        value = line.rstrip('\r\n')
        if not value and default and default != '__generate__':
            return default
        return value

def checked_prompt(terminal, label, default, check, *, secret=False):
    while True:
        value = terminal.ask(label, default, secret)
        try:
            check(value)
            return value
        except ValueError as error:
            print('输入不符合要求：' + str(error))

def require(condition, message):
    if not condition:
        raise ValueError(message)

def strong_password(value):
    return len(value) >= 10 and re.search("[a-z]", value) and re.search("[A-Z]", value) and re.search(r"[^A-Za-z0-9\s]", value) and not re.search(r"\s", value)

def validate(c):
    require(bool(re.fullmatch(r'[a-z_][a-z0-9_-]{0,30}', c['user'])) and c['user'] != 'root', '业务账号须为普通Linux用户名，不能为root')
    require(bool(re.fullmatch(r'/[A-Za-z0-9_./-]+', c['directory'])) and '..' not in Path(c['directory']).parts and c['directory'] not in ['/', '/home', '/opt', '/usr', '/etc', '/var'], '部署目录必须是独立绝对路径，仅使用英文、数字、点、下划线和连字符')
    require(bool(re.fullmatch(r'[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?', c['host'])), '访问地址请填IPv4或域名，不带http、端口或路径')
    ip = ipaddress.ip_address(c['bind'])
    require(ip.version == 4 and not ip.is_unspecified and not ip.is_loopback and not ip.is_multicast, 'dsh监听地址须为服务器本机的具体IPv4，不能为0.0.0.0或回环地址')
    ports = [c[k] for k in ['dsh_port', 'bridge_port', 'webui_port', 'vnc_port', 'http_port', 'ws_port']]
    require(all(type(p) is int and 1024 <= p <= 65535 for p in ports) and len(set(ports)) == len(ports), '六个端口须为1024～65535的不同整数')
    require(bool(re.fullmatch(r'[1-9][0-9]{4,11}', c['admin_qq'])), '请填写主人QQ号')
    require(strong_password(c['web_password']), '管理密码须至少10位，包含大小写字母及特殊符号且不含空白（官方密码规则）')
    require(len(c['vnc_password']) == 8 and all(33 <= ord(x) <= 126 for x in c['vnc_password']), 'VNC密码须为8个可见ASCII字符；VNC认证只使用前8字节')
    require(16 <= len(c['token']) <= 256 and all(33 <= ord(x) <= 126 for x in c['token']), 'OneBot Token须16～256个可见ASCII字符')
    endpoint = urllib.parse.urlsplit(c['model_url'])
    require(endpoint.scheme in ['http', 'https'] and endpoint.hostname and not endpoint.username and not endpoint.password and not endpoint.query and not endpoint.fragment, '模型URL须为不带凭据/查询参数的HTTP(S) Messages接口根地址')
    require(bool(c['model']) and len(c['model']) <= 200 and not re.search(r'[\x00-\x1f\x7f]', c['model']), '模型ID不能为空或包含控制字符')
    require(not re.search(r'[\x00-\x1f\x7f]', c['api_key']), 'API Key不能包含控制字符')
    require(bool(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._:/@-]*', c['image'])), '镜像请填写合法的Docker镜像引用')
    return c

def collect(terminal):
    try:
        route = run(['ip', '-4', 'route', 'get', '1.1.1.1'], capture=True)
        bind = re.search(r'\bsrc\s+(\S+)', route).group(1)
    except (InstallError, AttributeError, FileNotFoundError):
        bind = ''
    while True:
        c = {}
        c['user'] = terminal.ask('运行dsh的普通业务账号（不设置SSH密码）', 'dsh')
        c['directory'] = terminal.ask('部署文件和凭证目录', '/opt/dsh-snowluma-companion')
        c['host'] = terminal.ask('以后浏览器访问的服务器公网IPv4或域名')
        c['bind'] = terminal.ask('dsh监听的本机IPv4（云服务器通常填内网IP）', bind)
        for key, label, default in [('dsh_port', 'dsh网页端口', 3080), ('bridge_port', 'dsh反向WS端口', 6199), ('webui_port', 'SnowLuma管理端口', 5099), ('vnc_port', 'QQ远程桌面端口', 6081), ('http_port', 'OneBot HTTP端口', 3000), ('ws_port', 'OneBot正向WS端口', 3001)]:
            value = checked_prompt(terminal, label, str(default), lambda x: require(x.isdecimal() and 1024 <= int(x) <= 65535 and int(x) not in [c[k] for k in c if k.endswith('_port')], '请输入1024～65535的整数，且不能与前面端口重复'))
            c[key] = int(value)
        c['admin_qq'] = checked_prompt(terminal, '主人QQ号（不是机器人QQ号）', None, lambda x: require(bool(re.fullmatch(r'[1-9][0-9]{4,11}',x)), '请填有效QQ号'))
        while True:
            c['web_password'] = checked_prompt(terminal, '自行设置SnowLuma管理密码（至少10位、大小写及符号）', None, lambda x: require(strong_password(x),'至少10位，包含大小写字母、特殊符号且不含空白'), secret=True)
            if c['web_password'] == terminal.ask('再输入一次管理密码', secret=True): break
            print('两次管理密码不一致，请重新输入。')
        while True:
            c['vnc_password'] = checked_prompt(terminal, '自行设置远程桌面VNC密码（8个可见ASCII字符）', None, lambda x: require(len(x)==8 and all(33<=ord(v)<=126 for v in x),'须为8个可见ASCII字符'), secret=True)
            if c['vnc_password'] == terminal.ask('再输入一次VNC密码', secret=True): break
            print('两次VNC密码不一致，请重新输入。')
        c['token'] = terminal.ask('OneBot连接Token（可自己输入）', '__generate__', secret=True) or secrets.token_urlsafe(32)
        c['model_url'] = terminal.ask('DeepSeek Messages兼容接口根地址', 'https://api.deepseek.com/anthropic')
        c['model'] = terminal.ask('聊天模型ID', 'deepseek-flash')
        c['api_key'] = terminal.ask('模型API Key（可留空，之后在dsh模型页填写）', secret=True)
        c['image'] = terminal.ask('SnowLuma镜像（或已导入的本地镜像名）', 'motricseven7/snowluma:latest')
        try:
            validate(c)
            return c
        except ValueError as error:
            print('配置需要修改：' + str(error) + '。下面重新填写；尚未安装。')

def profile_patch(c, workspace):
    selection = 'deepseek-official/' + c['model']
    return [
        {'id': 'snowluma-bridge', 'config': {'ws_reverse_host': '0.0.0.0', 'ws_reverse_port': c['bridge_port'], 'ws_reverse_token': c['token'], 'admins': [c['admin_qq']], 'workspacePath': str(workspace), 'agentPreset': 'companion', 'privateModel': selection, 'groupModel': selection, 'adminPrivateModel': selection}},
        {'id': 'agent-default-model', 'config': {'provider': 'deepseek-official', 'model': c['model']}},
        {'id': 'llm-deepseek', 'config': {'baseURL': c['model_url'], 'models': [{'id': c['model'], 'name': c['model'], 'inputModalities': ['text', 'image']}]}},
    ]

def onebot_config(c):
    # Same factory endpoints as the official Docker image, plus the dsh WS client.
    base = {'host': '0.0.0.0', 'path': '/', 'accessToken': c['token'], 'messageFormat': 'array', 'reportSelfMessage': False}
    return {'networks': {'httpServers': [dict(base, name='http-default', port=3000, enableWebSocket=False)], 'httpClients': [], 'wsServers': [dict(base, name='ws-default', port=3001, role='Universal')], 'wsClients': [{'name': 'dsh', 'url': 'ws://host.docker.internal:' + str(c['bridge_port']) + '/ws', 'role': 'Universal', 'accessToken': c['token'], 'messageFormat': 'array', 'reportSelfMessage': False, 'reconnectIntervalMs': 3000}]}, 'statusCommand': {'enabled': True, 'swallow': False, 'cooldownSeconds': 5, 'trigger': '#sl'}, 'historySync': {'enabled': False}, 'notifications': {'channelIds': []}}

def compose_secrets(c):
    # Compose interpolates dollars even in JSON/YAML strings. $$ preserves a literal $.
    literal = lambda value: value.replace('$', '$$')
    return {'services': {'snowluma': {'environment': {'VNC_PASSWD': literal(c['vnc_password']), 'SNOWLUMA_WEBUI_BOOTSTRAP_PASSWORD': literal(c['web_password'])}}}}

def env_line(key, value):
    return key + '="' + value.replace('\\', '\\\\').replace('"', '\\"') + '"\n'

def systemd_unit(c, home):
    home = Path(home); node = home / '.local/node/bin/node'; binary = home / '.local/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js'
    quoted = lambda s: json.dumps(str(s).replace('%', '%%')).replace('$', '$$')
    args = [node, binary, 'web', '--host', c['bind'], '--port', str(c['dsh_port']), '--no-open', '--public-url', f"http://{c['host']}:{c['dsh_port']}/", '--trusted-host', f"{c['host']}:{c['dsh_port']}"]
    return '[Unit]\nDescription=DSH SnowLuma Companion\nAfter=network-online.target\nWants=network-online.target\n\n[Service]\nUser=' + c['user'] + '\nWorkingDirectory=' + str(home).replace('%', '%%') + '\nEnvironmentFile=' + str(home / '.config/dsh-companion/runtime.env').replace('%', '%%') + '\nExecStart=' + ' '.join(quoted(x) for x in args) + '\nRestart=always\nRestartSec=5\n\n[Install]\nWantedBy=multi-user.target\n'

def safe_extract(archive, destination):
    destination = Path(destination).resolve()
    with tarfile.open(archive, 'r:gz') as tar:
        for member in tar.getmembers():
            path = Path(member.name)
            target = (destination / path).resolve()
            if path.is_absolute() or '..' in path.parts or not target.is_relative_to(destination) or not (member.isdir() or member.isfile()):
                raise InstallError('安装包包含不支持的路径或链接。')
        # Validation above also works on Ubuntu Python versions lacking the data filter.
        for member in tar.getmembers():
            if member.isdir():
                (destination / member.name).mkdir(parents=True, exist_ok=True)
            else:
                p = destination / member.name; p.parent.mkdir(parents=True, exist_ok=True)
                with tar.extractfile(member) as src, p.open('wb') as dst: shutil.copyfileobj(src, dst)

class Downloads:
    def get(self, url, destination):
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'dsh-snowluma-companion-installer/' + VERSION}), timeout=60) as response, Path(destination).open('wb') as out:
            shutil.copyfileobj(response, out)
    def package(self, directory, local=None):
        archive = Path(directory) / ('dsh-snowluma-companion-' + VERSION + '.tgz')
        if local:
            shutil.copyfile(local, archive)
        else:
            meta = Path(directory) / 'release.json'
            self.get('https://api.github.com/repos/' + REPO + '/releases/tags/v' + VERSION, meta)
            release = json.loads(meta.read_text()); asset = next((a for a in release.get('assets', []) if a.get('name') == archive.name), None)
            if not asset or not re.fullmatch(r'sha256:[0-9a-f]{64}', asset.get('digest', '')):
                raise InstallError('GitHub发行包或SHA256摘要尚未就绪，请稍后重试。')
            self.get(asset['browser_download_url'], archive)
            if hashlib.sha256(archive.read_bytes()).hexdigest() != asset['digest'][7:]:
                raise InstallError('插件发行包SHA256校验失败。')
        unpacked = Path(directory) / 'unpacked'; unpacked.mkdir()
        safe_extract(archive, unpacked)
        package = unpacked / 'package'
        meta = json.loads((package / 'package.json').read_text())
        if meta.get('name') != 'dsh-snowluma-companion' or meta.get('version') != VERSION:
            raise InstallError('安装包名称或版本不匹配。')
        return archive, package

class Installer:
    def __init__(self, c, terminal, *, plugin_archive=None, image_archive=None, resume=False):
        self.c = validate(c); self.terminal = terminal; self.root = Path(c['directory'])
        self.plugin_archive = plugin_archive; self.image_archive = image_archive
        self.downloads = Downloads(); self.home = None; self.uid = self.gid = None
        self.resuming = resume; self.state = {}
    def preflight(self):
        if platform.system() != 'Linux' or not Path('/run/systemd/system').is_dir():
            raise InstallError('只支持运行systemd的Ubuntu服务器；不能在Mac或容器壳中直接部署。')
        release = dict(line.split('=', 1) for line in Path('/etc/os-release').read_text().splitlines() if '=' in line)
        if (release.get('ID', '').strip('"') != 'ubuntu' or release.get('VERSION_ID', '').strip('"') not in ['22.04', '24.04']) or platform.machine() not in ['x86_64', 'aarch64', 'arm64']:
            raise InstallError('当前仅支持Ubuntu22.04/24.04的amd64/arm64。')
        if os.geteuid() != 0:
            raise InstallError('请使用sudo或root运行安装入口。')
        if self.resuming:
            state = self.root / 'installation-state.json'
            if not state.is_file() or self.root.is_symlink():
                raise InstallError('没有本安装器的中断记录，不能接管已有环境。')
            self.state = json.loads(state.read_text())
            if self.state.get('version') != VERSION or self.state.get('status') not in ['installing', 'verifying']:
                raise InstallError('此记录不能续装；已完成的环境请使用--show-info。')
            account = pwd.getpwnam(self.c['user']); self.home = Path(account.pw_dir)
            self.uid, self.gid = account.pw_uid, account.pw_gid
            if str(self.home) != self.state.get('home'):
                raise InstallError('业务账号目录与安装记录不一致。')
            return
        if self.root.exists() or Path('/etc/systemd/system/dsh.service').exists() or run(['systemctl', 'list-unit-files', 'dsh.service', '--no-legend'], capture=True).strip():
            raise InstallError('已有部署目录或dsh服务，本脚本只负责全新安装，不覆盖现有环境。')
        try:
            account = pwd.getpwnam(self.c['user']); home = Path(account.pw_dir)
            if not re.fullmatch(r'/[A-Za-z0-9_./-]+', str(home)):
                raise InstallError('该账号HOME路径不受支持，请选择默认/home下的普通业务账号。')
            if account.pw_uid < 1000 or home == Path('/') or any((home / p).exists() for p in ['.dsh', '.local/dsh', '.local/node', '.config/dsh-companion']):
                raise InstallError('所选账号为系统账号或已有dsh/Node资料，请选择新的普通业务账号。')
        except KeyError:
            pass
        with socket.socket() as sock:
            try: sock.bind((self.c['bind'], 0))
            except OSError: raise InstallError('dsh监听IP不在本机网卡上，请填本机实际IPv4，不能填云端NAT公网IP。')
        for key in ['dsh_port', 'bridge_port', 'webui_port', 'vnc_port', 'http_port', 'ws_port']:
            with socket.socket() as sock:
                try: sock.bind(('0.0.0.0', self.c[key]))
                except OSError: raise InstallError('端口已被占用：' + str(self.c[key]) + '。没有改动已有服务。')
        if shutil.which('docker'):
            containers = run(['docker', 'ps', '-a', '--format', '{{.Names}}'], capture=True).splitlines()
            volumes = run(['docker', 'volume', 'ls', '--format', '{{.Name}}'], capture=True).splitlines()
            if 'snowluma' in containers or any(v in volumes for v in VOLUMES):
                raise InstallError('发现已有SnowLuma容器或命名卷，停止安装以保留现有登录与数据。')
    def dependencies(self):
        print('安装系统依赖…')
        env = dict(os.environ, DEBIAN_FRONTEND='noninteractive')
        run(['apt-get', 'update'], env=env)
        run(['apt-get', 'install', '-y', 'ca-certificates', 'curl', 'xz-utils', 'git', 'ffmpeg', 'build-essential', 'pkg-config', 'python3'], env=env)
        if not shutil.which('docker'):
            conflicts = subprocess.run(['dpkg-query', '-W', '-f=${db:Status-Status}', 'docker.io', 'containerd', 'runc', 'podman-docker'], capture_output=True, text=True).stdout
            if 'installed' in conflicts:
                raise InstallError('存在Docker冲突软件包；请按Docker官方说明处理后重试，不自动卸载现有软件。')
            Path('/etc/apt/keyrings').mkdir(exist_ok=True)
            self.downloads.get('https://download.docker.com/linux/ubuntu/gpg', '/etc/apt/keyrings/docker.asc'); os.chmod('/etc/apt/keyrings/docker.asc', 0o644)
            release = dict(line.split('=', 1) for line in Path('/etc/os-release').read_text().splitlines() if '=' in line)
            codename = release.get('UBUNTU_CODENAME', release.get('VERSION_CODENAME', '')).strip('"')
            arch = run(['dpkg', '--print-architecture'], capture=True).strip()
            write_private('/etc/apt/sources.list.d/docker.sources', f'Types: deb\nURIs: https://download.docker.com/linux/ubuntu\nSuites: {codename}\nComponents: stable\nArchitectures: {arch}\nSigned-By: /etc/apt/keyrings/docker.asc\n', mode=0o644)
            run(['apt-get', 'update'], env=env)
            run(['apt-get', 'install', '-y', 'docker-ce', 'docker-ce-cli', 'containerd.io', 'docker-buildx-plugin', 'docker-compose-plugin'], env=env)
        run(['docker', 'compose', 'version'], capture=True)
        run(['systemctl', 'enable', '--now', 'docker'])
    def account(self):
        try: account = pwd.getpwnam(self.c['user'])
        except KeyError:
            run(['useradd', '--create-home', '--shell', '/bin/bash', self.c['user']]); account = pwd.getpwnam(self.c['user'])
        self.home = Path(account.pw_dir); self.uid, self.gid = account.pw_uid, account.pw_gid
        self.root.mkdir(mode=0o700, parents=True)
        write_private(self.root / 'credentials.json', json.dumps(self.c, ensure_ascii=False, indent=2) + '\n')
        shutil.copy2(Path(__file__), self.root / 'install.py'); os.chmod(self.root / 'install.py', 0o700)
    def as_user(self, args, *, cwd=None):
        env = dict(os.environ, HOME=str(self.home), PATH=str(self.home / '.local/node/bin') + ':' + os.environ.get('PATH', ''))
        for key in ['DEEPSEEK_API_KEY', 'DEEPSEEK_BASE_URL']:
            env.pop(key, None)
        return run(['runuser', '-u', self.c['user'], '--', *[str(a) for a in args]], cwd=cwd or self.home, env=env)
    def runtime(self, temp):
        print('安装官方Node及dsh…')
        arch = 'x64' if platform.machine() == 'x86_64' else 'arm64'
        name = f'node-v{NODE_VERSION}-linux-{arch}.tar.xz'; archive = Path(temp) / name; sums = Path(temp) / 'SHASUMS256.txt'
        base = 'https://nodejs.org/dist/v' + NODE_VERSION + '/'
        self.downloads.get(base + name, archive); self.downloads.get(base + 'SHASUMS256.txt', sums)
        wanted = next((line.split()[0] for line in sums.read_text().splitlines() if line.split()[-1] == name), None)
        if not wanted or hashlib.sha256(archive.read_bytes()).hexdigest() != wanted:
            raise InstallError('Node发行包SHA256校验失败。')
        node = self.home / '.local/node'; node.mkdir(parents=True, exist_ok=True)
        run(['tar', '-xJf', archive, '-C', node, '--strip-components=1']); run(['chown', '-R', f'{self.uid}:{self.gid}', node])
        app = self.home / '.local/dsh'; app.mkdir(parents=True, exist_ok=True)
        write_private(app / 'package.json', json.dumps({'name': 'dsh-companion-runtime', 'private': True}), uid=self.uid, gid=self.gid)
        for owned in [self.home / '.local', app]: os.chown(owned, self.uid, self.gid)
        self.as_user([node / 'bin/npx', '--yes', 'pnpm@' + PNPM_VERSION, 'add', '@deepseek-ai/dsh@' + DSH_VERSION, '--dangerously-allow-all-builds'], cwd=app)
    def configure_dsh(self, archive):
        c = self.c; home = self.home; profile = home / '.dsh/profiles/web'; profile.mkdir(parents=True, exist_ok=True)
        packages = home / '.dsh/packages'; packages.mkdir(exist_ok=True)
        target = packages / Path(archive).name; shutil.copyfile(archive, target); os.chown(target, self.uid, self.gid); os.chmod(target, 0o600)
        workspace = home / '.dsh/workspace'; workspace.mkdir(exist_ok=True)
        pkg = {'name': 'dsh-profile-web', 'private': True, 'dsh': {'profile': {'bundles': ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'dsh-snowluma-companion']}}, 'dependencies': {'dsh-snowluma-companion': 'file:' + str(target)}}
        write_private(profile / 'pnpm-workspace.yaml', 'packages:\n  - .\nnodeLinker: hoisted\nautoInstallPeers: false\n', uid=self.uid, gid=self.gid)
        write_private(profile / 'package.json', json.dumps(pkg, indent=2) + '\n', uid=self.uid, gid=self.gid)
        write_private(profile / 'cordis.patch.yml', json.dumps(profile_patch(c, workspace), ensure_ascii=False, indent=2) + '\n', uid=self.uid, gid=self.gid)
        runtime = env_line('PATH', str(home / '.local/node/bin') + ':' + str(home / '.local/dsh/node_modules/.bin') + ':/usr/local/bin:/usr/bin:/bin')
        runtime += env_line('DEEPSEEK_API_KEY', c['api_key']) + env_line('DEEPSEEK_BASE_URL', c['model_url'])
        write_private(home / '.config/dsh-companion/runtime.env', runtime, uid=self.uid, gid=self.gid)
        for p in [home / '.dsh', home / '.config/dsh-companion']:
            run(['chown', '-R', f'{self.uid}:{self.gid}', p])
        os.chown(home / '.config', self.uid, self.gid)
        self.as_user([home / '.local/node/bin/npx', '--yes', 'pnpm@' + PNPM_VERSION, 'install', '--ignore-scripts'], cwd=profile)
        write_private('/etc/systemd/system/dsh.service', systemd_unit(c, home), mode=0o644)
        run(['systemctl', 'daemon-reload']); run(['systemctl', 'enable', '--now', 'dsh'])
    def configure_snowluma(self, package):
        c = self.c; print('部署官方SnowLuma容器…')
        if self.image_archive:
            run(['docker', 'load', '-i', self.image_archive])
        while subprocess.run(['docker', 'image', 'inspect', c['image']], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode:
            if subprocess.run(['docker', 'pull', c['image']]).returncode == 0: break
            replacement = self.terminal.ask('镜像拉取失败。输入你信任的替代镜像或已导入镜像名，留空退出')
            if not replacement: raise InstallError('无法取得SnowLuma镜像。未改Docker镜像源或关闭TLS验证；取得镜像后可按恢复说明继续。')
            c['image'] = replacement; validate(c)
            write_private(self.root / 'credentials.json', json.dumps(c, ensure_ascii=False, indent=2) + '\n')
        write_private(self.root / 'snowluma.compose.yml', (Path(package) / 'deploy/snowluma.compose.yml').read_text())
        values = {'SNOWLUMA_IMAGE': c['image'], 'SNOWLUMA_WEBUI_HOST_PORT': str(c['webui_port']), 'NOVNC_PORT': str(c['vnc_port']), 'ONEBOT_HTTP_PORT': str(c['http_port']), 'ONEBOT_WS_PORT': str(c['ws_port'])}
        write_private(self.root / '.env', ''.join(k + '=' + v + '\n' for k, v in values.items()))
        write_private(self.root / 'credentials.compose.json', json.dumps(compose_secrets(c), ensure_ascii=False, indent=2) + '\n')
        existing = run(['docker', 'volume', 'ls', '--format', '{{.Name}}'], capture=True).splitlines()
        for volume in VOLUMES:
            if volume in existing and volume not in self.state.get('owned_volumes', []):
                raise InstallError('发现不属于本次安装的数据卷，停止以免覆盖。')
            if volume not in self.state.setdefault('owned_volumes', []):
                self.state['owned_volumes'].append(volume); self.save_state()
            run(['docker', 'volume', 'create', volume], capture=True)
        volume = json.loads(run(['docker', 'volume', 'inspect', VOLUMES[0]], capture=True))[0]
        cfg = Path(volume['Mountpoint']) / 'config'
        cfg.mkdir(mode=0o700, exist_ok=True); os.chown(cfg, 1000, 1000)
        if not (cfg / 'onebot.json').exists():
            write_private(cfg / 'onebot.json', json.dumps(onebot_config(c), ensure_ascii=False, indent=2) + '\n', uid=1000, gid=1000)
        args = ['docker', 'compose', '--env-file', str(self.root / '.env'), '-f', str(self.root / 'snowluma.compose.yml'), '-f', str(self.root / 'credentials.compose.json')]
        run(args + ['config', '-q']); run(args + ['up', '-d', '--pull', 'never', '--no-build'])
        write_private(self.root / 'credentials.json', json.dumps(c, ensure_ascii=False, indent=2) + '\n')
    def save_state(self):
        write_private(self.root / 'installation-state.json', json.dumps(self.state, ensure_ascii=False, indent=2) + '\n')
    def step(self, name, action):
        if name not in self.state.get('completed', []):
            action()
            self.state.setdefault('completed', []).append(name); self.save_state()
    def install(self):
        self.preflight()
        with tempfile.TemporaryDirectory(prefix='dsh-companion-') as temp:
            local = self.plugin_archive
            cached = self.root / ('dsh-snowluma-companion-' + VERSION + '.tgz')
            if self.resuming and not local and cached.exists():
                if hashlib.sha256(cached.read_bytes()).hexdigest() != self.state.get('package_sha256'):
                    raise InstallError('续装缓存包校验失败。')
                local = cached
            archive, package = self.downloads.package(temp, local)
            if not self.resuming:
                self.dependencies(); self.account()
                self.state = {'version': VERSION, 'status': 'installing', 'home': str(self.home), 'completed': []}
                shutil.copyfile(archive, cached)
                self.state['package_sha256'] = hashlib.sha256(cached.read_bytes()).hexdigest(); self.save_state()
            self.step('runtime', lambda: self.runtime(temp))
            self.step('snowluma', lambda: self.configure_snowluma(package))
            self.step('dsh', lambda: self.configure_dsh(archive))
        self.state['status'] = 'verifying'; self.save_state()
        show_info(self.root, wait=True)
        self.state['status'] = 'installed'; self.save_state()

def login_url():
    raw = run(['journalctl', '-u', 'dsh', '-n', '3000', '--no-pager', '-o', 'cat'], capture=True)
    found = re.findall(r'dsh web: (https?://[^\s]+\?token=[A-Za-z0-9_-]+)', raw)
    return found[-1] if found else None

def probe(url):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(url, timeout=2) as response: return response.status
    except urllib.error.HTTPError as error: return error.code
    except (OSError, urllib.error.URLError): return None

def show_info(root, wait=False):
    root = Path(root); c = validate(json.loads((root / 'credentials.json').read_text()))
    end = time.monotonic() + (120 if wait else 0)
    auth_url = None
    while True:
        auth_url = login_url()
        ready = auth_url and probe(f"http://127.0.0.1:{c['webui_port']}/") == 200 and probe(f"http://127.0.0.1:{c['vnc_port']}/vnc.html") == 200
        if ready or time.monotonic() >= end: break
        time.sleep(2)
    if not ready:
        raise InstallError('服务尚未就绪，不能标记部署完成。检查sudo journalctl -u dsh及sudo docker logs snowluma，然后运行下方凭证查看命令重试。')
    if wait:
        # Confirm the password supplied by the user is accepted by the real WebUI auth endpoint.
        request = urllib.request.Request(f"http://127.0.0.1:{c['webui_port']}/api/login", data=json.dumps({'password': c['web_password']}).encode(), headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(request, timeout=5) as response:
                result = json.load(response)
                if response.status != 200 or result.get('success') is not True: raise InstallError('SnowLuma管理密码验证失败。')
        except (OSError, urllib.error.HTTPError):
            raise InstallError('SnowLuma管理密码验证失败，请检查镜像版本及官方WebUI接口；不输出未经验证的完成状态。')
    # Verify the actual dsh plugin endpoints using its official launch-token login.
    auth = urllib.parse.urlsplit(auth_url)
    internal = f"http://{c['bind']}:{c['dsh_port']}/"
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    try:
        opener.open(internal + '?' + auth.query, timeout=5).read()
        with opener.open(internal + 'api/snowluma-bridge/status', timeout=8) as response: bridge = json.load(response)
        with opener.open(internal + 'api/companion/state', timeout=5) as response: core = json.load(response)
        if not bridge.get('listening') or core.get('archive') is None or not core.get('snowluma'):
            raise InstallError('dsh插件或数据库未就绪。')
    except (OSError, urllib.error.URLError, ValueError):
        raise InstallError('dsh插件在线检查未通过，不能标记部署完成。')
    qq_state = 'QQ在线' if bridge.get('login') else '等待本人扫码'
    text = f'''SnowLuma Companion 部署完成（软件服务就绪；{qq_state}）

版本：插件 {VERSION} / dsh {DSH_VERSION} / Node {NODE_VERSION}
服务器访问地址：{c['host']}\nQQ状态：{qq_state}

dsh网页：http://{c['host']}:{c['dsh_port']}/
dsh登录方式：官方带Token链接，无固定用户名/密码；服务重启后用下面的查看命令取得新链接。
dsh当前登录链接：{auth_url}

SnowLuma管理页：http://{c['host']}:{c['webui_port']}/
SnowLuma管理身份：管理员（此版本登录接口只需密码，无可配置用户名）
SnowLuma管理密码（安装时保存值，自行改过后以新密码为准）：{c['web_password']}
QQ远程桌面：http://{c['host']}:{c['vnc_port']}/vnc.html
VNC用户名：无需填写
VNC密码：{c['vnc_password']}

OneBot HTTP：http://{c['host']}:{c['http_port']}/
OneBot正向WS：ws://{c['host']}:{c['ws_port']}/
OneBot Token：{c['token']}
SnowLuma容器内反向WS：ws://host.docker.internal:{c['bridge_port']}/ws
主人QQ：{c['admin_qq']}
模型接口：{c['model_url']}
模型ID：{c['model']}
模型API Key：{c['api_key'] or '未填写，请在dsh模型设置页配置'}

Linux业务账号：{c['user']}（未设置SSH/系统登录密码）
部署目录：{root}
查看最新地址和凭证：sudo python3 {root}/install.py --show-info {root}
dsh状态：sudo systemctl status dsh
SnowLuma状态：sudo docker ps --filter name=snowluma
软件本机连通已检测，公网是否可达取决于你的安全组/防火墙。
需要浏览器访问的入站TCP端口：{c['dsh_port']}、{c['webui_port']}、{c['vnc_port']}；HTTP/正向WS仅在使用时放行{c['http_port']}、{c['ws_port']}。
QQ操作：先在管理页本人确认协议，再在远程桌面扫码；扫码无法由脚本代替。
没有发出QQ测试消息或收费模型请求；群/普通私聊白名单默认空，可在统一设置页配置。
人格与记忆：新环境使用默认资料，已有数据可在“备份与迁移→恢复备份”导入，不包含原服务器私有资料。
'''
    write_private(root / '访问地址与凭证.txt', text)
    print(text)
    print('以上凭证已保存：' + str(root / '访问地址与凭证.txt') + '（仅root可读）。')

def main():
    parser = argparse.ArgumentParser(description='交互式部署dsh + SnowLuma + 陪伴助手，仅用于全新Ubuntu服务器。')
    parser.add_argument('--dry-run', action='store_true', help='交互收集配置并显示脱敏计划，不安装')
    parser.add_argument('--resume', metavar='DIRECTORY', help='根据本安装器私有记录继续中断的安装，不接管其他已有环境')
    parser.add_argument('--show-info', metavar='DIRECTORY', help='查看已安装环境的最新登录链接与保存凭证')
    parser.add_argument('--plugin-archive', help='使用本地同版本插件tgz；信任由操作者自行核验')
    parser.add_argument('--image-archive', help='使用本地Docker镜像归档，避免从Docker Hub下载')
    args = parser.parse_args()
    if args.show_info:
        if os.geteuid() != 0: raise InstallError('查看保存凭证需要sudo。')
        show_info(args.show_info); return
    if args.resume:
        root = Path(args.resume)
        c = json.loads((root / 'credentials.json').read_text())
        if Path(c['directory']).resolve() != root.resolve(): raise InstallError('续装目录与凭证记录不一致。')
        Installer(c, Terminal(), plugin_archive=args.plugin_archive, image_archive=args.image_archive, resume=True).install(); return
    terminal = Terminal()
    print('部署dsh + SnowLuma + 陪伴助手。保留官方Docker默认，按你的输入配置密码/端口/模型；不覆盖已有环境。')
    c = collect(terminal)
    if args.dry_run:
        plan = {k: ('[已填写]' if v else '[未填写]') if k in ['web_password', 'vnc_password', 'token', 'api_key'] else v for k, v in c.items()}
        print(json.dumps(plan, ensure_ascii=False, indent=2)); return
    if terminal.ask('按以上配置开始全新安装？输入yes继续') != 'yes':
        print('已取消，未开始安装。'); return
    Installer(c, terminal, plugin_archive=args.plugin_archive, image_archive=args.image_archive).install()

if __name__ == '__main__':
    try: main()
    except KeyboardInterrupt:
        print('已中断；如已生成私有安装记录，可使用--resume继续。', file=sys.stderr)
        raise SystemExit(130)
    except (InstallError, ValueError, OSError, KeyError, tarfile.TarError, urllib.error.URLError) as error:
        # Never print traceback/command arguments or captured output that might hold secrets.
        print('安装未完成：' + str(error), file=sys.stderr)
        print('已创建的数据不会自动删除。若已写入安装记录，可运行 sudo python3 <部署目录>/install.py --resume <部署目录> 继续；完成后用--show-info查看最新凭证。不要删除卷或覆盖其他已有环境。', file=sys.stderr)
        raise SystemExit(1)
