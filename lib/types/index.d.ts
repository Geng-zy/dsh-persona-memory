import z from '@deepseek-ai/schemastery';
import type { Context as CordisContext } from '@deepseek-ai/cordis';
import { type ContextMode, type NapcatLike, type RuleRow } from './rules.js';
export type { BeforeCompactPayload, CompanionService, ContextPolicy } from './service.js';
export type { RuleRow, Scope } from './rules.js';
export interface Config {
    excludedPresets: string[];
    personaOnly: boolean;
    selfEdit: boolean;
    historyKeep: number;
    coreMaxKB: number;
    thresholdPercent: number;
    masterMaxRounds: number;
    masterDropRounds: number;
    masterMode: ContextMode;
    privateMaxRounds: number;
    privateDropRounds: number;
    privateMode: ContextMode;
    groupMaxRounds: number;
    groupDropRounds: number;
    groupMode: ContextMode;
    summaryModel: string;
    rules: RuleRow[];
    archiveEnabled: boolean;
    archiveUnwoken: boolean;
    archiveDaysMaster: number;
    archiveDaysOthers: number;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
}
export type LiveConfig = {
    [K in keyof Config]: {
        get(): Config[K];
    };
};
export declare const Config: z<LiveConfig>;
export declare const name = "dsh-companion-core";
type Context = CordisContext & {
    napcat?: NapcatLike;
    agents?: {
        list(): any[];
    };
};
export declare function apply(ctx: Context, live: LiveConfig): void;
