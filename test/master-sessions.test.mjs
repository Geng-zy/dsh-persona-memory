import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { exportMasterSessions, importMasterSessions } from '../lib/master-sessions.js'
import { cleanItems, configuredItems, itemsOf } from '../lib/backup.js'

const prefix = 'snowluma-snowluma-FriendMessage-42'
const binding = { ownerId: '42', prefix, sessionId: prefix + '-rotated', cwd: '/new/workspace' }
function services() {
  const created = [], switched = [], reads = [], attachmentsRead = []
  const refs = [{ attachmentId: 'image-id', mediaType: 'image/png', bytes: 3, width: 1, height: 1 }, { attachmentId: 'file-id', name: 'test.txt', bytes: 3 }]
  const logs = [prefix, prefix + '-rotated', prefix + '3', 'snowluma-snowluma-GroupMessage-42', 'web-session', 'snowluma-snowluma-FriendMessage-77']
  let flushed = false
  const s = {
    bridge: { masterPrivateBindings: () => [binding], restoreMasterPrivateBinding: async (ownerId, id) => switched.push({ ownerId, id }) },
    persistence: {
      flush: async () => { flushed = true },
      list: async () => logs.map(id => ({ header: { id } })),
      open: async id => {
        assert.ok(flushed)
        const imported = created.find(r => r.header.id === id)
        if (imported) return { read: async () => ({ events: imported.events }), close: async () => {} }
        reads.push(id)
        return { header: { id, version: 4, createdAt: 1, isSeeded: false, cwd: '/old/workspace' }, inheritedEventCount: 0,
          read: async () => ({ events: [{ seq: 0, type: 'fake-event', payload: refs.map(attachment => ({ attachment })) }] }), close: async () => {} }
      },
      create: async (header, options) => {
        const record = { header, options }; created.push(record)
        return { append: async events => { record.events = events }, flush: async () => {}, close: async () => { record.closed = true } }
      },
    },
    attachments: {
      readImage: async ref => { attachmentsRead.push(ref.attachmentId); return { data: Buffer.from('abc') } },
      readFileStream: async function* (ref) { attachmentsRead.push(ref.attachmentId); yield Buffer.from('def') },
      saveImage: async () => refs[0], saveFile: async () => refs[1],
    },
  }
  return { s, created, switched, reads, attachmentsRead }
}

test('旧配置的存档选择只迁移设置，不误解释旧包内容', () => {
  assert.deepEqual(configuredItems(['archiveOthers', 'archiveMaster']), ['archiveMaster', 'sessionsMaster'])
  assert.deepEqual(cleanItems(['archiveOthers']), [])
  assert.deepEqual(itemsOf({ items: ['archiveOthers', 'archiveMaster'], formatVersion: 2 }), ['archiveMaster'])
})

test('只备份主人 QQ 私聊及轮换历史，附件按引用去重，恢复采用新 ID 和当前工作目录', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'master-sessions-'))
  try {
    const { s, created, switched, reads, attachmentsRead } = services()
    assert.equal(await exportMasterSessions(dir, s), 2)
    assert.deepEqual(reads, [prefix, prefix + '-rotated'])
    assert.deepEqual(attachmentsRead, ['image-id', 'file-id'])
    await importMasterSessions(dir, s)
    assert.equal(created.length, 2)
    assert.ok(created.every(r => r.header.id.startsWith(prefix + '-import-') && r.header.cwd === '/new/workspace' && r.closed && r.events.length === 1))
    assert.equal(switched.length, 1)
    assert.equal(switched[0].id, created[1].header.id)
    // 原日志并未打开写入，也没有删除 API。
    assert.deepEqual(reads, [prefix, prefix + '-rotated'])
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('拒绝旧管理员、群聊伪装、缺失附件；未提供服务不能静默生成空备份', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'master-sessions-'))
  try {
    const { s, created, switched } = services()
    await assert.rejects(exportMasterSessions(dir, {}), /新版/)
    await exportMasterSessions(dir, s)
    const file = join(dir, 'master-sessions.json'), original = JSON.parse(readFileSync(file, 'utf8'))
    for (const modify of [b => { b.sessions[0].ownerId = '77' }, b => { b.sessions[0].header.id = 'snowluma-snowluma-GroupMessage-42' }, b => { b.attachments.pop() }]) {
      const b = structuredClone(original); modify(b); writeFileSync(file, JSON.stringify(b))
      await assert.rejects(importMasterSessions(dir, s))
      assert.equal(created.length, 0); assert.equal(switched.length, 0)
    }
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
