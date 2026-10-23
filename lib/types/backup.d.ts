import { DatabaseSync } from 'node:sqlite';
export declare const BACKUP_FORMAT = "dsh-companion-backup";
export declare const BACKUP_FORMAT_VERSION = 1;
export interface Manifest {
    format: typeof BACKUP_FORMAT;
    formatVersion: number;
    plugin: string;
    schema: number;
    createdAt: number;
    reason: 'auto' | 'manual' | 'before-import';
    counts: {
        memories: number;
        diaryDays: number;
        months: number;
        archiveMessages: number;
        media: number;
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
/**
 * 插件启动时（打开数据库之前）调用：有待导入的数据就替换进来。
 * 旧数据先挪到 .replaced-<时间>，成功后删掉（导入前已经自动备份过）。返回导入的清单（没有待导入时 undefined）。
 */
export declare function applyPendingImport(dataDir: string): Manifest | undefined;
