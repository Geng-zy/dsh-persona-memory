import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, rm, symlink, realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {createHash} from 'node:crypto'
import { ensureQqWorkspace } from '../lib/qq-workspace.js'

test('QQ工作区创建目录并注册；重复调用依赖宿主同路径复用，不重复创建身份', async () => {
  const root = await mkdtemp(join(tmpdir(), 'qq-workspace-'))
  const records = new Map()
  const registry = { create: async (path, title) => {
    if (!records.has(path)) records.set(path, { id: 'workspace-1', path, title })
    return records.get(path)
  } }
  try {
    const path = join(root, 'QQ')
    const a = await ensureQqWorkspace(registry, path)
    const b = await ensureQqWorkspace(registry, path)
    assert.equal(a, b)
    assert.equal(a.title, 'QQ')
    assert.equal(records.size, 1)
    const alias = join(root, 'alias')
    await symlink(path, alias)
    assert.equal(await ensureQqWorkspace(registry, alias), a)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('不接受相对工作区路径，不调用宿主注册或退回其他目录', async () => {
  let called = false
  await assert.rejects(ensureQqWorkspace({ create: async () => { called = true } }, './QQ'), /绝对路径/)
  assert.equal(called, false)
})

import { QqWorkspaceManager } from '../lib/qq-workspace.js'

function migrationHarness(path, { busy = false, corrupt = false } = {}) {
  const records = new Map([['snowluma-snowluma-FriendMessage-42', { header: { id: 'snowluma-snowluma-FriendMessage-42', cwd: '/old', version: 4 }, inheritedEventCount: 0, events: [{ type: 'user/message', seq: 1, time: 1, data: { text: '保留原文' } }] }]])
  const archived = [], attached = [], replacements = [], memo = new Map()
  const persistence = {
    list: async () => [...records.values()].map(r => ({ header: r.header })), stat: async id => records.get(id),
    open: async id => ({ ...records.get(id), append:async events=>{records.get(id).events.push(...structuredClone(events))},flush:async()=>{}, read: async () => ({ events: records.get(id).events }), close: async () => {} }),
    create: async (header, options) => { records.set(header.id, { header, inheritedEventCount: options.inheritedEventCount, events: [] }); return {
      append: async events => { records.get(header.id).events = corrupt ? [{type:'corrupt',data:{}}] : structuredClone(events) }, flush: async () => {}, close: async () => {},
    } },
  }
  const deps = { registry: { archivedSessionIds: archived, create: async p => ({ id: 'QQ', title: 'QQ', path: p, attachSession: async id => attached.push(id) }), archiveSession: async id => { if (!archived.includes(id)) archived.push(id) } }, persistence, configuredPath: () => path,
    busy: () => busy, owned: id => id.startsWith('snowluma-'), replace: (a, b) => replacements.push([a, b]), memo: { get: k => memo.get(k), set: (k, v) => memo.set(k, v) } }
  return { manager: new QqWorkspaceManager(deps), deps, records, archived, attached, replacements }
}

test('工作区迁移完整复制并校验历史，再切换映射、归档原会话；重试不重复复制或归档新会话', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qq-migrate-'))
  try {
    const h = migrationHarness(dir), old = [...h.records.keys()][0], original = structuredClone(h.records.get(old))
    const current = await h.manager.prepare(old)
    assert.notEqual(current, old)
    assert.deepEqual(h.records.get(old), original)
    assert.deepEqual(h.records.get(current).events, original.events)
    assert.equal(h.records.get(current).header.cwd, await realpath(dir))
    assert.deepEqual(h.replacements, [[old, current]])
    assert.deepEqual(h.archived, [old])
    const restarted = new QqWorkspaceManager(h.deps)
    assert.equal(await restarted.prepare(old), current)
    assert.equal(h.records.size, 2)
    assert.deepEqual(h.archived, [old], '原会话因迁移归档不能导致重试时把新会话也归档')
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('迁移失败或原会话活动时，不切换映射、不归档原会话', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'qq-migrate-'))
  try {
    for (const options of [{ busy: true }, { corrupt: true }]) {
      const h = migrationHarness(dir, options)
      if(options.busy)assert.equal(await h.manager.prepare([...h.records.keys()][0]),[...h.records.keys()][0])
      else await assert.rejects(h.manager.prepare([...h.records.keys()][0]))
      assert.deepEqual(h.replacements, [])
      assert.deepEqual(h.archived, [])
    }
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('工作区复制中断留下合法前缀时，重试补齐历史，路径再次改变时不重复迁移历史祖先',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'qq-recover-'))
 try{
  const h=migrationHarness(dir),old=[...h.records.keys()][0],source=h.records.get(old)
  source.events.push({type:'user/message',seq:2,time:2,data:{text:'SECOND'}})
  const destination=old+'-ws-'+createHash('sha256').update(await realpath(dir)).digest('hex').slice(0,12)
  h.records.set(destination,{header:{...source.header,id:destination,cwd:await realpath(dir)},inheritedEventCount:0,events:structuredClone(source.events.slice(0,1))})
  assert.deepEqual(h.archived,[])
  assert.equal(await h.manager.prepare(old),destination)
  assert.deepEqual(h.records.get(destination).events,source.events)
  assert.deepEqual(h.archived,[old])
  h.deps.configuredPath=()=>join(dir,'second')
  const result=await new QqWorkspaceManager(h.deps).migrateAll()
  assert.equal(result.migrated,1,'只迁移当前副本，跳过已迁移历史祖先')
  assert.equal(h.records.size,3)
 }finally{await rm(dir,{recursive:true,force:true})}
})
