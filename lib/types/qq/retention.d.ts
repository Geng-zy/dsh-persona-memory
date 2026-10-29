import type { Archive } from './archive.js';
import type { Category, Scope } from './rules.js';
interface MaintenanceReport {
    at: number;
    expired: Array<{
        umo: string;
        deleted: number;
        rotated?: string;
        error?: string;
    }>;
    deletedSessions: string[];
    failedSessions: Array<{
        sessionId: string;
        error: string;
    }>;
    mediaRemoved: number;
}
interface Deps {
    archive: Archive;
    organizer: {
        categoryOf(umo: string, kind: string): Category;
        organizeUmo(umo: string, reason: string): Promise<unknown>;
    };
    settings(): {
        rotateSessions: boolean;
        deleteOldSessions: boolean;
        carryMessages: number;
        archiveDays(s: Scope): number;
    };
    snowluma(): {
        rotateSession?(umo: string): Promise<{
            oldSessionId: string;
            newSessionId: string;
        }>;
    } | undefined;
    registry(): {
        archiveSession?(id: string, options?: {
            stopActivity?: boolean;
        }): Promise<void>;
        unarchiveSession?(id: string): Promise<void>;
        list?(): Array<{
            sessionIds: readonly string[];
            detachSession?(id: string): Promise<void>;
        }>;
    } | undefined;
    persistence(): {
        stat(id: string): Promise<unknown>;
        list?(): Promise<unknown[]>;
    } | undefined;
    isLive(id: string): boolean;
    isRunning(id: string): boolean;
    sessionsRoot: string;
    mediaDir: string;
    setCarry(umo: string, text: string): void;
    log(level: 'debug' | 'info' | 'warn', message: string): void;
}
export declare class QqRetention {
    private readonly deps;
    private running?;
    last?: MaintenanceReport;
    constructor(deps: Deps);
    run(now?: number): Promise<MaintenanceReport>;
    private doRun;
    private expire;
    private archiveSession;
    /**
     * 删一个已归档的旧会话（dsh 没有删除接口，这是我们自己的做法，端到端测试验证过）：
     * 确认不在跑 → 从工作区移除 → 删掉会话文件夹 → 从归档列表去掉 → 确认 dsh 查不到它了、列表还正常。
     * 只删插件一建的 QQ 会话（id 以 snowluma- 开头），文件夹必须在 <DSH_HOME>/sessions 里。
     */
    deleteSession(id: string): Promise<void>;
    /** 删掉没被存档引用的图片，返回删了几个。 */
    private gcMedia;
}
export {};
