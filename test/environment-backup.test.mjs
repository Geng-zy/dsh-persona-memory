import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EnvironmentBackup, environmentName } from '../lib/environment-backup.js'

test('完整环境备份通道：未安装不写入、固定任务排队、拒绝重复和越界/软链接下载', () => {
 const dir=mkdtempSync(join(tmpdir(),'environment-channel-'))
 try {
  const env=new EnvironmentBackup(dir)
  assert.deepEqual(env.state(),{available:false});assert.throws(()=>env.request())
  mkdirSync(join(dir,'inbox'));mkdirSync(join(dir,'archives'));writeFileSync(join(dir,'helper.json'),'{}')
  const schedule={schedule:'daily',time:'04:30',weekday:7,keep:5,timezone:'Asia/Shanghai'}
  env.schedule(schedule);assert.deepEqual(JSON.parse(readFileSync(join(dir,'inbox','schedule.json'))),schedule)
  env.request();assert.equal(env.state().pending,true);assert.throws(()=>env.request())
  const name='environment-20261028-043000-1234abcd.tar.gz'
  assert.equal(environmentName(name),true);assert.equal(env.file('../'+name),undefined)
  symlinkSync(join(dir,'helper.json'),join(dir,'archives',name));assert.equal(env.file(name),undefined)
  rmSync(join(dir,'archives',name));writeFileSync(join(dir,'archives',name),'bytes');assert.equal(env.file(name),join(dir,'archives',name))
  rmSync(join(dir,'inbox','request.json'));writeFileSync(join(dir,'status.json'),JSON.stringify({phase:'packing'}));assert.throws(()=>env.request())
 } finally {rmSync(dir,{recursive:true,force:true})}
})
