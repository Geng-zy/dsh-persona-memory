import { DatabaseSync } from 'node:sqlite';
export declare const BACKUP_FORMAT = "dsh-companion-backup";
export declare const BACKUP_FORMAT_VERSION = 2;
/** 能备份的东西，顺序就是设置页里的顺序 */
export declare const ITEMS: readonly ['persona', 'core', 'diary', 'memory', 'archiveMaster', 'archiveOthers', 'settingsCompanion', 'settingsBridge', 'settingsDsh'];
export type BackupItem = typeof ITEMS[number];
/** 默认勾选：别人的私聊和群聊存档不带（只留 5 天，本来就是临时的） */
export declare const DEFAULT_ITEMS: BackupItem[];
export declare const SETTINGS_ITEMS: BackupItem[];
export declare function cleanItems(list: unknown): BackupItem[];
/** 包里有哪些（旧包没写就按旧版固定内容算） */
export declare function itemsOf(m: Manifest): BackupItem[];
/** 设置文件：settings/<名字>.json，内容是 { ns, user }（user = 用户改过的字段，已去掉 Key） */
export interface SavedSettings {
    ns: string;
    user: Record<string, unknown>;
}
export declare const SETTINGS_FILES: Record<string, BackupItem>;
export interface Manifest {
    format: typeof BACKUP_FORMAT;
    formatVersion: number;
    plugin: string;
    schema: number;
    createdAt: number;
    reason: 'auto' | 'manual' | 'before-import';
    /** 包里有哪些（格式 2 起有） */
    items?: BackupItem[];
    /** archiveMessages 是主人的存档条数；othersMessages 是别人的（格式 2 起有） */
    counts: {
        memories: number;
        diaryDays: number;
        months: number;
        archiveMessages: number;
        media: number;
        othersMessages?: number;
    };
    range: {
        from?: number;
        to?: number;
    };
    embed: {
        model?: string;
        dim?: number;
    };
    settings: Record<string, unknown>;
    files: Array<{
        path: string;
        sha256: string;
        size: number;
    }>;
}
export interface BackupInfo {
    name: string;
    size: number;
    createdAt: number;
    reason?: string;
}
export interface CreateOptions {
    dataDir: string;
    db: DatabaseSync;
    outDir: string;
    reason: Manifest['reason'];
    plugin: string;
    schema: number;
    settings: Record<string, unknown>;
    embed: Manifest['embed'];
    keep: number;
    /** 备份哪些；不给就是默认的 */
    items?: readonly BackupItem[];
    /** 设置文件（名字见 SETTINGS_FILES），只放勾选了的 */
    settingsFiles?: Record<string, unknown>;
    now?: number;
}
/** 打一个备份包，返回文件名。超过 keep 份的旧的（同类：自动的只删自动的）删掉。 */
export declare function createBackup(o: CreateOptions): Promise<{
    name: string;
    manifest: Manifest;
}>;
/** 备份文件列表，新的在前。 */
export declare function listBackups(outDir: string): BackupInfo[];
/** 每一类（自动、手动、导入前）各留 keep 份。 */
export declare function prune(outDir: string, keep: number): void;
export declare function safeBackupName(name: string): boolean;
/** 解开一个备份包、核对清单和校验值。返回解开的目录和清单。 */
export declare function inspectBackup(file: string, workDir: string): Promise<{
    dir: string;
    manifest: Manifest;
}>;
/** 包里的设置文件（只读勾选了的）。 */
export declare function readSavedSettings(dir: string, items: readonly BackupItem[]): Record<string, SavedSettings | Record<string, SavedSettings>>;
/** 确认导入时写进待导入目录：要还原哪些、设置套用的结果（重新加载后显示） */
export interface RestorePlan {
    items: BackupItem[];
    notes?: string[];
}
/**
 * 插件启动时（打开数据库之前）调用：有待导入的数据就按勾选还原。
 * 先换数据库（一个事务，失败什么都不动），再换文件夹（旧的先挪开，失败放回去），图片只补不删。
 * 返回导入的清单和勾选（没有待导入时 undefined）。
 */
export declare function applyPendingImport(dataDir: string): {
    manifest: Manifest;
    plan: RestorePlan;
} | undefined;
