import importlib.util
import io
import json
import os
import stat
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('installer', ROOT / 'deploy/install.py')
installer = importlib.util.module_from_spec(spec); spec.loader.exec_module(installer)

def config(directory='/opt/test-companion'):
    return {'user':'companion-test','directory':directory,'host':'example.test','bind':'10.0.0.10','dsh_port':3080,'bridge_port':6199,'webui_port':5099,'vnc_port':6081,'http_port':3000,'ws_port':3001,'admin_qq':'10001','web_password':'Fake$Password!123','vnc_password':'Fake$123','token':'test-token-123456789','model_url':'https://api.example.test/anthropic','model':'deepseek-flash','api_key':'fake-key-"$\\value','image':'motricseven7/snowluma:latest'}

class Tests(unittest.TestCase):
    def test_supported_ubuntu_releases(self):
        # Exercise the real preflight gate, stopping before any installation or mutation.
        import platform
        for version, accepted in [('22.04', True), ('24.04', True), ('26.04', True), ('20.04', False), ('26.10', False)]:
            with self.subTest(version=version):
                original_read = Path.read_text
                def read(path, *args, **kwargs):
                    if str(path) == '/etc/os-release': return 'ID=ubuntu\nVERSION_ID="' + version + '"\n'
                    return original_read(path, *args, **kwargs)
                with patch.object(platform, 'system', return_value='Linux'), patch.object(Path, 'exists', return_value=True), patch.object(Path, 'read_text', read), patch.object(platform, 'machine', return_value='x86_64'), patch('os.geteuid', return_value=0), patch.object(Path, 'is_dir', return_value=True):
                    with self.assertRaises(installer.InstallError) as error:
                        installer.Installer(config(), None).preflight()
                    self.assertIn('已有部署目录' if accepted else '当前仅支持', str(error.exception))

    def test_bootstrap_pins_the_installer_digest(self):
        import hashlib,re
        expected=re.search(r'INSTALLER_SHA256=([a-f0-9]{64})', (ROOT/'install.sh').read_text()).group(1)
        self.assertEqual(hashlib.sha256((ROOT/'deploy/install.py').read_bytes()).hexdigest(),expected)
    def test_validation_and_no_implicit_public_binding(self):
        installer.validate(config())
        for change in [{'user':'root'},{'bind':'0.0.0.0'},{'vnc_password':'too-long-password'},{'web_password':'weak'},{'bridge_port':3080},{'model_url':'https://user:pass@example.test'},{'directory':'/'}]:
            with self.subTest(change=next(iter(change))):
                with self.assertRaises(ValueError):installer.validate(dict(config(),**change))
    def test_compose_and_environment_preserve_credential_characters(self):
        c=config();rendered=installer.compose_secrets(c)['services']['snowluma']['environment']
        self.assertEqual(rendered['VNC_PASSWD'].replace('$$','$'),c['vnc_password'])
        self.assertEqual(rendered['SNOWLUMA_WEBUI_BOOTSTRAP_PASSWORD'].replace('$$','$'),c['web_password'])
        self.assertEqual(installer.env_line('API_KEY','a"b\\c$def'), 'API_KEY="a\\"b\\\\c$def"\n')
    def test_secret_files_are_private_and_symlinks_are_refused(self):
        with tempfile.TemporaryDirectory() as temp:
            p=Path(temp)/'secret';installer.write_private(p,'secret')
            self.assertEqual(stat.S_IMODE(p.stat().st_mode),0o600)
            link=Path(temp)/'link';link.symlink_to(p)
            with self.assertRaises(OSError):installer.write_private(link,'overwrite')
            self.assertEqual(p.read_text(),'secret')
    def test_package_extract_rejects_traversal_and_links(self):
        with tempfile.TemporaryDirectory() as temp:
            for kind in ['traversal','link','normal']:
                archive=Path(temp)/(kind+'.tgz')
                with tarfile.open(archive,'w:gz') as tar:
                    item=tarfile.TarInfo('../escape' if kind=='traversal' else 'package/file')
                    if kind=='link':item.type=tarfile.SYMTYPE;item.linkname='/etc/passwd';tar.addfile(item)
                    else:item.size=2;tar.addfile(item,io.BytesIO(b'ok'))
                target=Path(temp)/kind;target.mkdir()
                if kind=='normal':installer.safe_extract(archive,target);self.assertEqual((target/'package/file').read_text(),'ok')
                else:
                    with self.assertRaises(installer.InstallError):installer.safe_extract(archive,target)
            self.assertFalse((Path(temp)/'escape').exists())
    def test_ws_defaults_and_model_profile_are_coherent(self):
        c=config();onebot=installer.onebot_config(c);nets=onebot['networks']
        self.assertEqual(nets['wsClients'][0]['url'],'ws://host.docker.internal:6199/ws')
        self.assertEqual(nets['httpServers'][0]['name'],'http-default');self.assertEqual(nets['wsServers'][0]['name'],'ws-default')
        self.assertTrue(onebot['statusCommand']['enabled'])
        rows=installer.profile_patch(c,Path('/tmp/workspace'));bridge=rows[0]['config']
        self.assertEqual(bridge['ws_reverse_token'],nets['wsClients'][0]['accessToken'])
        self.assertEqual(bridge['admins'],['10001'])
        self.assertNotIn(c['api_key'],json.dumps(rows))
        unit=installer.systemd_unit(c,Path('/home/companion-test'))
        self.assertIn('--trusted-host',unit);self.assertIn('example.test:3080',unit)
        self.assertNotIn(c['web_password'],unit);self.assertNotIn(c['api_key'],unit)
    def test_releases_must_provide_verified_digest(self):
        class MissingDigest(installer.Downloads):
            def get(self,url,destination):Path(destination).write_text(json.dumps({'assets':[{'name':'dsh-qq-gateway-'+installer.VERSION+'.tgz'}]}))
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaises(installer.InstallError):MissingDigest().package(temp)
    def test_resume_keeps_finished_steps_and_does_not_reinstall(self):
        with tempfile.TemporaryDirectory() as temp:
            c=config(temp+'/install');item=installer.Installer(c,None)
            item.root.mkdir();item.state={'completed':[]}
            calls=[]
            item.step('runtime',lambda:calls.append('runtime'))
            reloaded=installer.Installer(c,None,resume=True);reloaded.state=json.loads((item.root/'installation-state.json').read_text())
            reloaded.step('runtime',lambda:calls.append('duplicate'))
            with self.assertRaises(RuntimeError):reloaded.step('snowluma',lambda:(_ for _ in ()).throw(RuntimeError('network failed')))
            self.assertNotIn('snowluma',json.loads((item.root/'installation-state.json').read_text())['completed'])
            reloaded.step('snowluma',lambda:calls.append('snowluma'))
            self.assertEqual(calls,['runtime','snowluma'])
    def test_info_refuses_fake_success_and_does_not_print_credentials(self):
        c=config()
        with tempfile.TemporaryDirectory() as temp:
            (Path(temp)/'credentials.json').write_text(json.dumps(c))
            with patch.object(installer,'login_url',return_value=None),patch.object(installer,'probe',return_value=None),patch('sys.stdout',new_callable=io.StringIO) as out:
                with self.assertRaises(installer.InstallError):installer.show_info(temp)
                self.assertNotIn(c['web_password'],out.getvalue())

if __name__=='__main__':unittest.main()
