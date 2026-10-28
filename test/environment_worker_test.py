import datetime as dt
import importlib.util
import json
import os
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('worker',Path(__file__).parents[1]/'scripts/environment-backup.py')
w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)

class WorkerTest(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
  self.base=self.root/'backups';self.base.mkdir();(self.base/'archives').mkdir();(self.base/'inbox').mkdir()
  self.src=self.root/'data';self.src.mkdir();(self.src/'credentials.yml').write_text('private-fixture');(self.src/'history').mkdir();(self.src/'history'/'old.md').write_text('old');(self.src/'link').symlink_to('credentials.yml')
  self.config=dict(directory=str(self.base),gid=os.getgid(),sources=[str(self.src)],required=[str(self.src)],exclude=[str(self.src/'history')],services=[])
  self.s=w.schedule(dict(schedule='daily',time='04:30',weekday=7,keep=5,timezone='Asia/Shanghai'))
 def tearDown(self):self.temp.cleanup()
 def test_atomic_status_with_restrictive_service_umask(self):
  previous=os.umask(0o077)
  try:w.atomic(self.base/'status.json',{'phase':'done'},os.getgid())
  finally:os.umask(previous)
  self.assertEqual((self.base/'status.json').stat().st_mode & 0o777,0o640)
 def test_schedule(self):
  before=dt.datetime.fromisoformat('2026-10-27T20:29:00+00:00');after=dt.datetime.fromisoformat('2026-10-27T20:30:00+00:00')
  self.assertFalse(w.due(self.s,None,before));self.assertTrue(w.due(self.s,None,after));self.assertFalse(w.due(self.s,'2026-10-28',after))
  for row in [dict(time='24:00'),dict(time='4:30'),dict(keep=6),dict(keep=True),dict(weekday=0),dict(schedule='bad'),dict(timezone='../bad')]:
   with self.assertRaises(Exception):w.schedule(row)
 def test_roundtrip_retention_and_failed_copy(self):
  for i in range(7):
   path=w.make_backup(self.config,self.s,{})
  self.assertEqual(len(list((self.base/'archives').glob('*.tar.gz'))),5)
  m=w.verify(path);self.assertFalse(any('history' in r['path'] for r in m['files']));self.assertTrue(any('credentials.yml' in r['path'] for r in m['files']))
  dest=self.root/'restored';dest.mkdir();w.restore(path,dest,True)
  restored=dest/str(self.src).lstrip('/')
  self.assertEqual((restored/'credentials.yml').read_text(),'private-fixture');self.assertEqual(os.readlink(restored/'link'),'credentials.yml')
  self.assertFalse((restored/'history').exists())
  before=set((self.base/'archives').glob('*.tar.gz'))
  cfg={**self.config,'services':['dsh','napcat']};calls=[]
  with patch.object(w,'active',return_value=True),patch.object(w,'control',side_effect=lambda s,a:calls.append((s,a))),patch.object(w,'copy_source',side_effect=OSError('fixture copy failure')):
   with self.assertRaises(OSError):w.make_backup(cfg,self.s,{})
  self.assertEqual(calls,[('dsh','stop'),('napcat','stop'),('napcat','start'),('dsh','start')]);self.assertEqual(before,set((self.base/'archives').glob('*.tar.gz')))
 def test_reject_corruption_and_traversal_before_restore(self):
  path=w.make_backup(self.config,self.s,{})
  bad=self.root/'bad.tar.gz'
  with tarfile.open(path) as src,tarfile.open(bad,'w:gz') as dst:
   for m in src.getmembers():
    if m.name.endswith('credentials.yml'):
     import io
     b=b'changed';m.size=len(b);dst.addfile(m,io.BytesIO(b))
    else:dst.addfile(m,src.extractfile(m) if m.isfile() else None)
  with self.assertRaises(ValueError):w.verify(bad)
  with tarfile.open(bad,'w:gz') as dst:
   m=tarfile.TarInfo('../escape');m.size=0;dst.addfile(m)
  with self.assertRaises(ValueError):w.verify(bad)
 def test_interrupted_copy_recovers_only_configured_services(self):
  w.atomic(self.base/'status.json',dict(phase='copying',resumeServices=['dsh','unrelated']),os.getgid())
  (self.base/'inbox'/'schedule.json').write_text(json.dumps({**self.s,'schedule':'off'}))
  with patch.object(w,'control') as control:w.tick({**self.config,'services':['dsh']})
  control.assert_called_once_with('dsh','start');self.assertEqual(w.read_json(self.base/'status.json')['phase'],'failed')

if __name__=='__main__':unittest.main()
