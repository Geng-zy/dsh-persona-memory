/** 数据结构版本；以后改表结构时加升级步骤，不丢旧数据。 */
export declare const SCHEMA_VERSION = 1;
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
    private readonly db;
    constructor(path: string);
    private migrate;
    /** 存一条；同一会话同一 QQ 消息 id 只存一次。返回是否新存了。 */
    add(m: ArchivedMessage): boolean;
    /** 某个会话最近的几条（新的在后）。 */
    recent(umo: string, limit: number, before?: number): ArchivedMessage[];
    stats(): ArchiveStats;
    close(): void;
}
