/** WorkspaceRegistry 的公开能力；不改写 dsh 的工作区存储。 */
export interface QqWorkspaceRegistry {
    create(path: string, title?: string): Promise<{
        readonly id: string;
        readonly path: string;
        readonly title: string;
    }>;
}
export declare function defaultQqWorkspacePath(): string;
/** 安装/启用时注册目录；同一路径由 dsh 复用工作区，避免重复安装产生重复项。 */
export declare function ensureQqWorkspace(registry: QqWorkspaceRegistry, configuredPath?: string): Promise<{
    readonly id: string;
    readonly path: string;
    readonly title: string;
}>;
import type { SessionHeader } from '@deepseek-ai/dsh-session';
import type { SessionPersistence } from './qq/master-sessions.js';
interface Workspace extends Awaited<ReturnType<QqWorkspaceRegistry['create']>> {
    attachSession(id: string): Promise<void>;
    readonly sessionIds?: readonly string[];
}
interface Registry extends QqWorkspaceRegistry {
    create(path: string, title?: string): Promise<Workspace>;
    archiveSession(id: string): Promise<void>;
    readonly archivedSessionIds: readonly string[];
}
interface Persistence extends SessionPersistence {
    open(id: string, access: 'read' | 'write'): ReturnType<SessionPersistence['open']>;
    stat(id: string): Promise<{
        header: SessionHeader;
    } | undefined>;
}
/** 不改原会话文件；逻辑复制、验证、归档成功后，调用方才提交QQ映射。 */
export declare class QqWorkspaceManager {
    private readonly deps;
    private current?;
    private tasks;
    constructor(deps: {
        registry: Registry;
        persistence: Persistence;
        configuredPath(): string;
        busy(id: string): boolean;
        memo?: {
            get(key: string): string | undefined;
            set(key: string, value: string): void;
        };
        owned(id: string): boolean;
        replace(oldId: string, newId: string): void;
    });
    snapshot(): {
        id: string | undefined;
        path: string;
        sessionCount: number;
    };
    get path(): string;
    initialize(): Promise<void>;
    attach(id: string): Promise<void>;
    prepare(id: string): Promise<string>;
    private copy;
    migrateAll(): Promise<{
        migrated: number;
        deferred: number;
    }>;
}
export {};
