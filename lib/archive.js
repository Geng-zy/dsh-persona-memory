// 消息存档：QQ 上收到和发出的每条消息（含没唤醒她的群消息），按 QQ 原样存进 SQLite。
// 和 dsh 的会话日志不是一回事：会话日志记的是交给模型的内容，归 dsh 管；这里记的是 QQ 上真实发生过的聊天。
// 用 Node 自带的 node:sqlite（不用装原生模块），一个文件 companion.db，带数据结构版本号。
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
/** 数据结构版本；以后改表结构时加升级步骤，不丢旧数据。 */
export const SCHEMA_VERSION = 2;
const MAX_SEGMENTS = 32 * 1024;
export class Archive {
    path;
    /** 同一个数据库文件里还有记忆表（memory.ts 共用这个连接） */
    db;
    constructor(path) {
        this.path = path;
        if (path !== ':memory:')
            mkdirSync(dirname(path), { recursive: true });
        this.db = new DatabaseSync(path);
        this.db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
        this.migrate();
    }
    migrate() {
        this.db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
        const row = this.db.prepare("SELECT value FROM meta WHERE key = 'schema'").get();
        const current = row === undefined ? 0 : Number(row.value);
        if (current > SCHEMA_VERSION)
            throw new Error('数据库版本 ' + current + ' 比插件支持的 ' + SCHEMA_VERSION + ' 新，请升级插件');
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
      `);
        }
        if (current < 2) {
            // 版本 2：长期记忆、彻底遗忘留下的指纹、每个会话「已整理到哪条」
            this.db.exec(`
        CREATE TABLE IF NOT EXISTS memories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          scope TEXT NOT NULL,
          kind TEXT NOT NULL,
          content TEXT NOT NULL,
          importance REAL NOT NULL,
          trust REAL NOT NULL,
          writer TEXT NOT NULL,
          source_umo TEXT,
          source_session TEXT,
          source_from INTEGER,
          source_to INTEGER,
          created_at INTEGER NOT NULL,
          tz TEXT NOT NULL,
          last_recalled INTEGER,
          recall_count INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'active',
          forgotten_at INTEGER,
          superseded_by INTEGER,
          hash TEXT NOT NULL,
          embedding BLOB,
          embed_model TEXT
        );
        CREATE INDEX IF NOT EXISTS memories_scope ON memories (scope, status);
        CREATE INDEX IF NOT EXISTS memories_hash ON memories (hash);
        CREATE TABLE IF NOT EXISTS tombstones (hash TEXT NOT NULL, scope TEXT NOT NULL, purged_at INTEGER NOT NULL, PRIMARY KEY (hash, scope));
        CREATE TABLE IF NOT EXISTS cursors (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
      `);
        }
        this.db.prepare("INSERT INTO meta (key, value) VALUES ('schema', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(String(SCHEMA_VERSION));
    }
    /** 存一条；同一会话同一 QQ 消息 id 只存一次。返回是否新存了。 */
    add(m) {
        const segments = m.segments !== undefined && m.segments.length > MAX_SEGMENTS ? m.segments.slice(0, MAX_SEGMENTS) : m.segments;
        const r = this.db.prepare(`INSERT OR IGNORE INTO messages
      (umo, kind, user_id, group_id, message_id, time, direction, sender_id, sender_name, woke, type, text, segments, session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(m.umo, m.kind, m.userId ?? null, m.groupId ?? null, m.messageId ?? null, Math.round(m.time), m.direction, m.senderId, m.senderName, m.woke ? 1 : 0, m.type, m.text, segments ?? null, m.sessionId ?? null);
        return Number(r.changes) > 0;
    }
    /** 某个会话最近的几条（新的在后）。 */
    recent(umo, limit, before) {
        const rows = this.db.prepare(`SELECT * FROM messages WHERE umo = ? AND time < ? ORDER BY time DESC, id DESC LIMIT ?`)
            .all(umo, before ?? Number.MAX_SAFE_INTEGER, limit);
        return rows.reverse().map(fromRow);
    }
    /** 某个会话 id 大于 afterId 的消息（按时间顺序），用来整理「还没整理过的部分」。返回带存档 id。 */
    since(umo, afterId, limit = 500) {
        const rows = this.db.prepare('SELECT * FROM messages WHERE umo = ? AND id > ? ORDER BY id LIMIT ?').all(umo, afterId, limit);
        return rows.map(r => ({ ...fromRow(r), id: Number(r.id) }));
    }
    /** 有消息的会话（umo）和各自最大的存档 id。 */
    umos() {
        return this.db.prepare('SELECT umo, MAX(id) AS maxId, MAX(kind) AS kind FROM messages GROUP BY umo').all()
            .map(r => ({ umo: r.umo, maxId: Number(r.maxId), kind: r.kind }));
    }
    /**
     * 群里她没看到的消息：她上一次发言之后、没唤醒她的那些（唤醒她的已经在会话里了），
     * 不含 excludeMessageId（正在处理的这条），最多 limit 条，按时间顺序。
     */
    unseen(umo, limit, excludeMessageId) {
        if (limit <= 0)
            return [];
        // 按存进来的先后（id）判断，不按时间：QQ 的消息时间只精确到秒，她发出的记的是毫秒，同一秒里会排错
        const last = this.db.prepare("SELECT MAX(id) AS i FROM messages WHERE umo = ? AND direction = 'out'").get(umo);
        const rows = this.db.prepare(`SELECT * FROM messages WHERE umo = ? AND direction = 'in' AND woke = 0 AND type = 'message' AND id > ?
      AND (message_id IS NULL OR message_id != ?) ORDER BY id DESC LIMIT ?`)
            .all(umo, last.i ?? 0, excludeMessageId ?? '', limit);
        return rows.reverse().map(fromRow);
    }
    /** 「已整理到哪条」之类的小计数。 */
    cursor(key) {
        const r = this.db.prepare('SELECT value FROM cursors WHERE key = ?').get(key);
        return r === undefined ? 0 : Number(r.value);
    }
    setCursor(key, value) {
        this.db.prepare('INSERT INTO cursors (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, Math.round(value));
    }
    stats() {
        const total = Number(this.db.prepare('SELECT COUNT(*) AS n FROM messages').get().n);
        const byKind = {};
        for (const r of this.db.prepare('SELECT kind, COUNT(*) AS n FROM messages GROUP BY kind').all())
            byKind[r.kind] = Number(r.n);
        const range = this.db.prepare('SELECT MIN(time) AS a, MAX(time) AS b FROM messages').get();
        return { total, byKind, ...(range.a !== null ? { oldest: Number(range.a) } : {}), ...(range.b !== null ? { newest: Number(range.b) } : {}) };
    }
    close() {
        this.db.close();
    }
}
function fromRow(r) {
    return {
        umo: r.umo, kind: r.kind,
        ...(r.user_id !== null ? { userId: r.user_id } : {}),
        ...(r.group_id !== null ? { groupId: r.group_id } : {}),
        ...(r.message_id !== null ? { messageId: r.message_id } : {}),
        time: Number(r.time), direction: r.direction, senderId: r.sender_id, senderName: r.sender_name,
        woke: r.woke === 1, type: r.type, text: r.text,
        ...(r.segments !== null ? { segments: r.segments } : {}),
        ...(r.session_id !== null ? { sessionId: r.session_id } : {}),
    };
}
