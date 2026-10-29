// 消息存档：QQ 上收到和发出的每条消息（含没唤醒她的群消息），按 QQ 原样存进 SQLite。
// 和 dsh 的会话日志不是一回事：会话日志记的是交给模型的内容，归 dsh 管；这里记的是 QQ 上真实发生过的聊天。
// 用 Node 自带的 node:sqlite（不用装原生模块），独立QQ数据库，兼容旧存档结构版本号；不建立人格、记忆、关系图或日记表。
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
/** 数据结构版本；以后改表结构时加升级步骤，不丢旧数据。 */
export const SCHEMA_VERSION = 5;
const MAX_SEGMENTS = 32 * 1024;
export class Archive {
    path;
    /** 仅QQ消息、分类和到期状态。 */
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
        this.db.exec('CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL)');
        const current = Number(this.db.prepare("SELECT value FROM meta WHERE key='schema'").get()?.value ?? 0);
        if (current > SCHEMA_VERSION)
            throw new Error('QQ存档数据库版本比当前插件新');
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
        CREATE TABLE IF NOT EXISTS retired (
          session_id TEXT PRIMARY KEY,
          umo TEXT NOT NULL,
          category TEXT NOT NULL,
          retired_at INTEGER NOT NULL,
          last_time INTEGER NOT NULL,
          state TEXT NOT NULL,
          note TEXT
        );
      CREATE TABLE IF NOT EXISTS cursors(key TEXT PRIMARY KEY,value INTEGER NOT NULL);
    `);
        this.db.prepare("INSERT INTO meta(key,value) VALUES('schema',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(String(SCHEMA_VERSION));
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
    /** 这条消息之前，会话里最近的 limit 条（收到的和她发出的都算，按存进来的先后，不按时间：QQ 消息时间只精确到秒）。 */
    lastMessages(umo, limit, excludeMessageId) {
        if (limit <= 0)
            return [];
        const rows = this.db.prepare(`SELECT * FROM messages WHERE umo = ? AND type = 'message' AND (message_id IS NULL OR message_id != ?)
      ORDER BY id DESC LIMIT ?`).all(umo, excludeMessageId ?? '', limit);
        return rows.reverse().map(fromRow);
    }
    //#region 到期、换会话
    /** 她在某个会话里最后一次说话的时间。 */
    lastOutTime(umo) {
        const r = this.db.prepare("SELECT MAX(time) AS t FROM messages WHERE umo = ? AND direction = 'out'").get(umo);
        return r.t === null ? undefined : Number(r.t);
    }
    /** 某个会话最后一条（收到或发出）的时间。 */
    lastTime(umo) {
        const r = this.db.prepare('SELECT MAX(time) AS t FROM messages WHERE umo = ?').get(umo);
        return r.t === null ? undefined : Number(r.t);
    }
    /** 某个会话最早一条的时间。 */
    oldest(umo) {
        const r = this.db.prepare('SELECT MIN(time) AS t FROM messages WHERE umo = ?').get(umo);
        return r.t === null ? undefined : Number(r.t);
    }
    /** 删掉某个会话 cutoff 之前的存档，返回删了几条。 */
    deleteBefore(umo, cutoff) {
        return Number(this.db.prepare('DELETE FROM messages WHERE umo = ? AND time < ?').run(umo, cutoff).changes);
    }
    /** 这个 QQ 会话现在对应的 dsh 会话（存档里最近一条带会话 id 的），以及这个 dsh 会话最早一条消息的时间。 */
    currentSession(umo) {
        const r = this.db.prepare('SELECT session_id FROM messages WHERE umo = ? AND session_id IS NOT NULL ORDER BY id DESC LIMIT 1').get(umo);
        if (r === undefined)
            return undefined;
        const t = this.db.prepare('SELECT MIN(time) AS a, MAX(time) AS b FROM messages WHERE session_id = ?').get(r.session_id);
        return { sessionId: r.session_id, firstTime: Number(t.a), lastTime: Number(t.b) };
    }
    /** 一段时间里几个会话的消息（写日记用），按时间顺序。 */
    between(umos, from, to) {
        if (umos.length === 0)
            return [];
        const rows = this.db.prepare('SELECT * FROM messages WHERE umo IN (' + umos.map(() => '?').join(', ') + ") AND time > ? AND time <= ? AND type = 'message' ORDER BY time, id")
            .all(...umos, from, to);
        return rows.map(fromRow);
    }
    /** 补上收到消息后才下载好的图片等（改那条的消息段）。 */
    updateSegments(umo, messageId, segments) {
        this.db.prepare("UPDATE messages SET segments = ? WHERE umo = ? AND message_id = ? AND direction = 'in'").run(segments, umo, messageId);
    }
    /** 存档里还引用着的本地图片文件名。 */
    mediaRefs() {
        const out = new Set();
        for (const r of this.db.prepare("SELECT segments FROM messages WHERE segments LIKE '%\"_local\"%'").all()) {
            for (const m of r.segments.matchAll(/"_local":"([0-9a-f]{64}\.[a-z0-9]+)"/g))
                out.add(m[1]);
        }
        return out;
    }
    retire(r) {
        this.db.prepare(`INSERT INTO retired (session_id, umo, category, retired_at, last_time, state, note) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET state = excluded.state, note = excluded.note, last_time = MAX(last_time, excluded.last_time)`)
            .run(r.sessionId, r.umo, r.category, Date.now(), r.lastTime, r.state, r.note ?? null);
    }
    isRetired(sessionId) {
        return this.db.prepare('SELECT 1 FROM retired WHERE session_id = ?').get(sessionId) !== undefined;
    }
    retiredList() {
        return this.db.prepare('SELECT * FROM retired ORDER BY retired_at DESC LIMIT 200').all().map(r => ({
            sessionId: r.session_id, umo: r.umo, category: r.category, retiredAt: Number(r.retired_at), lastTime: Number(r.last_time), state: r.state, ...(r.note ? { note: r.note } : {}),
        }));
    }
    //#endregion
    /** 「已整理到哪条」之类的小计数。 */
    cursor(key) {
        const r = this.db.prepare('SELECT value FROM cursors WHERE key = ?').get(key);
        return r === undefined ? 0 : Number(r.value);
    }
    setCursor(key, value) {
        this.db.prepare('INSERT INTO cursors (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, Math.round(value));
    }
    stats() {
        // 同一次扫描取得总数和时间范围，返回值与空库行为不变。
        const range = this.db.prepare('SELECT COUNT(*) AS n, MIN(time) AS a, MAX(time) AS b FROM messages').get();
        const byKind = {};
        for (const r of this.db.prepare('SELECT kind, COUNT(*) AS n FROM messages GROUP BY kind').all())
            byKind[r.kind] = Number(r.n);
        return { total: Number(range.n), byKind, ...(range.a !== null ? { oldest: Number(range.a) } : {}), ...(range.b !== null ? { newest: Number(range.b) } : {}) };
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
