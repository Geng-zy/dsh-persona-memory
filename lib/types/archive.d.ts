import { DatabaseSync } from 'node:sqlite';
/** 数据结构版本；以后改表结构时加升级步骤，不丢旧数据。 */
export declare const SCHEMA_VERSION = 2;
export interface ArchivedMessage {
    /** unified_msg_origin */
    umo: string;
    kind: 'private' | 'group';
    userId?: string;
    groupId?: string;
    /** QQ 消息 id（她发出的没有） */
    messageId?: string;
    /** 毫秒，UTC */
    time: number;
    direction: 'in' | 'out';
    senderId: string;
    senderName: string;
    /** 有没有唤醒她（交给模型） */
    woke: boolean;
    /** message：消息；notice：通知/请求（text 是中文描述） */
    type: 'message' | 'notice';
    text: string;
    /** 原始消息段（JSON，截断到 32KB） */
    segments?: string;
    /** 当时对应的 dsh 会话 */
    sessionId?: string;
}
export interface ArchiveStats {
    total: number;
    byKind: Record<string, number>;
    oldest?: number;
    newest?: number;
}
export declare class Archive {
    readonly path: string;
    /** 同一个数据库文件里还有记忆表（memory.ts 共用这个连接） */
    readonly db: DatabaseSync;
    constructor(path: string);
    private migrate;
    /** 存一条；同一会话同一 QQ 消息 id 只存一次。返回是否新存了。 */
    add(m: ArchivedMessage): boolean;
    /** 某个会话最近的几条（新的在后）。 */
    recent(umo: string, limit: number, before?: number): ArchivedMessage[];
    /** 某个会话 id 大于 afterId 的消息（按时间顺序），用来整理「还没整理过的部分」。返回带存档 id。 */
    since(umo: string, afterId: number, limit?: number): Array<ArchivedMessage & {
        id: number;
    }>;
    /** 有消息的会话（umo）和各自最大的存档 id。 */
    umos(): Array<{
        umo: string;
        maxId: number;
        kind: string;
    }>;
    /**
     * 群里她没看到的消息：她上一次发言之后、没唤醒她的那些（唤醒她的已经在会话里了），
     * 不含 excludeMessageId（正在处理的这条），最多 limit 条，按时间顺序。
     */
    unseen(umo: string, limit: number, excludeMessageId?: string): ArchivedMessage[];
    /** 「已整理到哪条」之类的小计数。 */
    cursor(key: string): number;
    setCursor(key: string, value: number): void;
    stats(): ArchiveStats;
    close(): void;
}
