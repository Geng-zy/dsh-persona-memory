import type { Archive } from './archive.js';
import { type DiaryStore } from './diary.js';
import { type LlmLike, type ModelTarget } from './extract.js';
import type { MemoryStore } from './memory.js';
import type { Organizer } from './organizer.js';
export interface MaintenanceSettings {
    diaryEnabled: boolean;
    monthlyEnabled: boolean;
    boundaryHour: number;
    timeZone: string;
}
export interface MaintenanceDeps {
    archive: Archive;
    store: MemoryStore;
    diary: DiaryStore;
    organizer: Organizer;
    llm(): LlmLike | undefined;
    target(): ModelTarget | undefined;
    settings(): MaintenanceSettings;
    log(level: 'debug' | 'info' | 'warn', message: string): void;
}
export interface MaintenanceReport {
    at: number;
    diary?: {
        date: string;
        written: boolean;
        month?: string;
        error?: string;
    };
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
export declare class Maintenance {
    private readonly deps;
    private running;
    last: MaintenanceReport | undefined;
    constructor(deps: MaintenanceDeps);
    /** 跑一遍（同时只跑一个）。 */
    run(now?: number): Promise<MaintenanceReport>;
    private doRun;
    /** 主人的 QQ 会话（存档里记着类别是主人的）。 */
    private masterUmos;
    writeDiary(now: number): Promise<NonNullable<MaintenanceReport['diary']>>;
}
