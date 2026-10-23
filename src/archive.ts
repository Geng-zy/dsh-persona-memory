// 消息存档：QQ 上收到和发出的每条消息（含没唤醒她的群消息），按 QQ 原样存进 SQLite。
// 和 dsh 的会话日志不是一回事：会话日志记的是交给模型的内容，归 dsh 管；这里记的是 QQ 上真实发生过的聊天。
// 用 Node 自带的 node:sqlite（不用装原生模块），一个文件 companion.db，带数据结构版本号。

import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/** 数据结构版本；以后改表结构时加升级步骤，不丢旧数据。 */
export const SCHEMA_VERSION = 1

export interface ArchivedMessage {
  /** unified_msg_origin */
  umo: string
  kind: 'private' | 'group'
  userId?: string
  groupId?: string
  /** QQ 消息 id（她发出的没有） */
  messageId?: string
  /** 毫秒，UTC */
  time: number
  direction: 'in' | 'out'
  senderId: string
  senderName: string
  /** 有没有唤醒她（交给模型） */
  woke: boolean
  /** message：消息；notice：通知/请求（text 是中文描述） */
  type: 'message' | 'notice'
  text: string
  /** 原始消息段（JSON，截断到 32KB） */
  segments?: string
  /** 当时对应的 dsh 会话 */
  sessionId?: string
}

export interface ArchiveStats {
  total: number
  byKind: Record<string, number>
  oldest?: number
  newest?: number
}

const MAX_SEGMENTS = 32 * 1024

export class Archive {
  private readonly db: DatabaseSync

  constructor(readonly path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.db = new DatabaseSync(path)
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;')
    this.migrate()
  }

  private migrate(): void {
    this.db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    const row = this.db.prepare("SELECT value FROM meta WHERE key = 'schema'").get() as { value: string } | undefined
    const current = row === undefined ? 0 : Number(row.value)
    if (current > SCHEMA_VERSION) throw new Error('数据库版本 ' + current + ' 比插件支持的 ' + SCHEMA_VERSION + ' 新，请升级插件')
    if (current < 1) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          umo TEXT NOT NULL,
          kind TEXT NOT NULL,
          user_id TEXT,
          group_id TEXT,
          message_id TEXT,
          time INTEGER NOT NULL,
          direction TEXT NOT NULL,
          sender_id TEXT NOT NULL,
          sender_name TEXT NOT NULL,
          woke INTEGER NOT NULL,
          type TEXT NOT NULL,
          text TEXT NOT NULL,
          segments TEXT,
          session_id TEXT
        );
        CREATE INDEX IF NOT EXISTS messages_umo_time ON messages (umo, time);
        CREATE INDEX IF NOT EXISTS messages_time ON messages (time);
        CREATE UNIQUE INDEX IF NOT EXISTS messages_dedupe ON messages (umo, direction, message_id) WHERE message_id IS NOT NULL;
      `)
    }
    this.db.prepare("INSERT INTO meta (key, value) VALUES ('schema', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(String(SCHEMA_VERSION))
  }

  /** 存一条；同一会话同一 QQ 消息 id 只存一次。返回是否新存了。 */
  add(m: ArchivedMessage): boolean {
    const segments = m.segments !== undefined && m.segments.length > MAX_SEGMENTS ? m.segments.slice(0, MAX_SEGMENTS) : m.segments
    const r = this.db.prepare(`INSERT OR IGNORE INTO messages
      (umo, kind, user_id, group_id, message_id, time, direction, sender_id, sender_name, woke, type, text, segments, session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      m.umo, m.kind, m.userId ?? null, m.groupId ?? null, m.messageId ?? null, Math.round(m.time), m.direction,
      m.senderId, m.senderName, m.woke ? 1 : 0, m.type, m.text, segments ?? null, m.sessionId ?? null,
    )
    return Number(r.changes) > 0
  }

  /** 某个会话最近的几条（新的在后）。 */
  recent(umo: string, limit: number, before?: number): ArchivedMessage[] {
    const rows = this.db.prepare(`SELECT * FROM messages WHERE umo = ? AND time < ? ORDER BY time DESC, id DESC LIMIT ?`)
      .all(umo, before ?? Number.MAX_SAFE_INTEGER, limit) as Array<Record<string, any>>
    return rows.reverse().map(fromRow)
  }

  stats(): ArchiveStats {
    const total = Number((this.db.prepare('SELECT COUNT(*) AS n FROM messages').get() as { n: number }).n)
    const byKind: Record<string, number> = {}
    for (const r of this.db.prepare('SELECT kind, COUNT(*) AS n FROM messages GROUP BY kind').all() as Array<{ kind: string; n: number }>) byKind[r.kind] = Number(r.n)
    const range = this.db.prepare('SELECT MIN(time) AS a, MAX(time) AS b FROM messages').get() as { a: number | null; b: number | null }
    return { total, byKind, ...(range.a !== null ? { oldest: Number(range.a) } : {}), ...(range.b !== null ? { newest: Number(range.b) } : {}) }
  }

  close(): void {
    this.db.close()
  }
}

function fromRow(r: Record<string, any>): ArchivedMessage {
  return {
    umo: r.umo, kind: r.kind,
    ...(r.user_id !== null ? { userId: r.user_id } : {}),
    ...(r.group_id !== null ? { groupId: r.group_id } : {}),
    ...(r.message_id !== null ? { messageId: r.message_id } : {}),
    time: Number(r.time), direction: r.direction, senderId: r.sender_id, senderName: r.sender_name,
    woke: r.woke === 1, type: r.type, text: r.text,
    ...(r.segments !== null ? { segments: r.segments } : {}),
    ...(r.session_id !== null ? { sessionId: r.session_id } : {}),
  }
}
