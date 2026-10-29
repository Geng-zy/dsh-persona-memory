export interface TypingProfile {
    enabled: boolean;
    charsPerMinute: number;
    minSeconds: number;
    maxSeconds: number;
}
export type TypingCategory = 'adminPrivate' | 'private' | 'group';
export interface PaceSettings {
    /** Missing profiles retain the pre-split settings for backwards compatibility. */
    typingProfiles?: Partial<Record<TypingCategory, TypingProfile>>;
    typingPrivate: boolean;
    typingGroup: boolean;
    /** 每分钟打几个字 */
    charsPerMinute: number;
    typingMinSeconds: number;
    typingMaxSeconds: number;
    /** 同一个群两条之间至少隔几秒（0 = 不限） */
    groupMinGapSeconds: number;
    /** 一段时间里最多发几条（0 = 不限） */
    groupMaxPerWindow: number;
    groupWindowSeconds: number;
    /** 为了守频率最多等几秒，超过就不发了 */
    maxWaitSeconds: number;
}
export interface PacerDeps {
    settings(): PaceSettings;
    log(level: 'debug' | 'info' | 'warn', message: string): void;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
}
/** Group membership takes precedence: an administrator speaking in a group still uses group typing. */
export declare function typingProfile(s: PaceSettings, isGroup: boolean, adminPrivate?: boolean): TypingProfile;
/** 按会话类型计算打字等待，管理员私聊与普通私聊分别设置。 */
export declare function typingDelay(text: string, isGroup: boolean, s: PaceSettings, adminPrivate?: boolean): number;
/** Each split segment uses the same category profile and the existing per-segment cap. */
export declare function splitTyping(segments: readonly string[], isGroup: boolean, s: PaceSettings, maxSegmentSeconds: number, adminPrivate?: boolean): number[];
/** 为了守群里的发言频率还要等多久（毫秒）；sent 是这个群最近发出的时间（从早到晚）。 */
export declare function rateDelay(sent: readonly number[], now: number, s: PaceSettings): number;
export declare class Pacer {
    private readonly deps;
    private queues;
    private sent;
    private readonly now;
    private readonly sleep;
    get pendingCount(): number;
    constructor(deps: PacerDeps);
    /**
     * 排进这个会话的队列，等打字、守频率，然后发。返回发了没有。
     * typingMs：分段发送时由调用方给出这一段分到的打字时间（整条回复算一次，按长度分给各段）。
     */
    run(umo: string, isGroup: boolean, text: string, send: () => Promise<void | boolean>, typingMs?: number, bypassRateLimit?: boolean, adminPrivate?: boolean): Promise<'sent' | 'dropped'>;
    private one;
}
