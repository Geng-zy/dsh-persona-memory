export { normalizeDocument } from './upstream-documents.js';
import z from '@deepseek-ai/schemastery';
import type { IncomingMessage, ServerResponse } from 'node:http';
export interface UpdateConfig {
    updatesEnabled: boolean;
    updatesReaderFallback: boolean;
    updatesIntervalDays: number;
    updatesAutoAnalyze: boolean;
    updatesModelSource: 'dsh' | 'api';
    updatesApiUrl: string;
    updatesApiKey: string;
    updatesApiModel: string;
    updatesApiProtocol: 'openai' | 'anthropic';
    updatesModelProvider: string;
    updatesModel: string;
    updatesMaxTokens: number;
    updatesMaxModelCalls: number;
    updatesModelTimeoutSeconds: number;
    updatesGithubToken: string;
    updatesMailEnabled: boolean;
    updatesSmtpHost: string;
    updatesSmtpPort: number;
    updatesSmtpUser: string;
    updatesSmtpPass: string;
    updatesMailTo: string;
    updatesPushService: 'off' | 'serverchan' | 'pushplus';
    updatesPushKey: string;
    updatesExtraSources: string;
}
export declare const updateSchema: {
    updatesModelSource: z<"api" | "dsh", "api" | "dsh", "volatile-defined">;
    updatesApiUrl: z<string, string, "volatile-defined">;
    updatesApiKey: z<string, string, "volatile">;
    updatesApiModel: z<string, string, "volatile-defined">;
    updatesApiProtocol: z<"anthropic" | "openai", "anthropic" | "openai", "volatile-defined">;
    updatesReaderFallback: z<boolean, boolean, "volatile-defined">;
    updatesEnabled: z<boolean, boolean, "volatile-defined">;
    updatesIntervalDays: z<number, number, "volatile-defined">;
    updatesAutoAnalyze: z<boolean, boolean, "volatile-defined">;
    updatesModelProvider: z<string, string, "volatile-defined">;
    updatesModel: z<string, string, "volatile-defined">;
    updatesMaxTokens: z<number, number, "volatile-defined">;
    updatesMaxModelCalls: z<number, number, "volatile-defined">;
    updatesModelTimeoutSeconds: z<number, number, "volatile-defined">;
    updatesGithubToken: z<string, string, "volatile">;
    updatesMailEnabled: z<boolean, boolean, "volatile-defined">;
    updatesSmtpHost: z<string, string, "volatile-defined">;
    updatesSmtpPort: z<number, number, "volatile-defined">;
    updatesSmtpUser: z<string, string, "volatile-defined">;
    updatesSmtpPass: z<string, string, "volatile">;
    updatesMailTo: z<string, string, "volatile-defined">;
    updatesPushService: z<"off" | "pushplus" | "serverchan", "off" | "pushplus" | "serverchan", "volatile-defined">;
    updatesPushKey: z<string, string, "volatile">;
    updatesExtraSources: z<string, string, "volatile-defined">;
};
export type SourceKind = 'npm' | 'pypi' | 'github' | 'github-file' | 'document' | 'node-lts' | 'ffmpeg-release' | 'lifecycle' | 'github-tags' | 'docker-image';
export interface UpdateSource {
    id: string;
    name: string;
    kind: SourceKind;
    target: string;
    current?: string;
    range?: string;
    purpose: string;
    files?: string[];
    prerelease?: boolean;
    path?: string;
    category: string;
    ltsProduct?: string;
    baselineKind?: string;
    managedCount?: number;
}
export interface Catalog {
    owner: string;
    version: string;
    repository: string;
    lockHash: string;
    sources: UpdateSource[];
    managedSources?: (UpdateSource & {
        managedBy: string;
        managedReason: string;
    })[];
    limitations: string[];
}
export interface Finding {
    id: string;
    name: string;
    status: 'update' | 'current' | 'baseline' | 'changed' | 'unknown' | 'error';
    current: string;
    latest?: string;
    source: string;
    checkedAt: number;
    publishedAt?: string;
    notes: string;
    versions?: string[];
    fingerprint?: string;
    purpose: string;
    category: string;
    files?: string[];
    deprecated?: string;
    advisories?: string[];
}
export declare function redact(text: string, secrets?: string[]): string;
export declare function extraSources(text: string): UpdateSource[];
export declare function chooseNpmVersion(data: any, prerelease: boolean): string | undefined;
export interface UpdateDeps {
    catalog: Catalog;
    directory: string;
    settings: () => UpdateConfig;
    fetch?: typeof fetch;
    now?: () => number;
    llm?: () => {
        stream(options: Record<string, unknown>): AsyncIterable<unknown>;
    } | undefined;
    notify?: (channel: 'mail' | 'push', title: string, text: string) => Promise<void>;
}
export declare class UpdateMonitor {
    private readonly deps;
    private state;
    private busy;
    private analyzing;
    private testingModel;
    private notificationTask?;
    private closed;
    private abort;
    private requestCache;
    private task?;
    private analyzeTask?;
    private readonly now;
    private readonly doFetch;
    private readonly file;
    constructor(deps: UpdateDeps);
    private secrets;
    private clean;
    private save;
    snapshot(): Record<string, unknown>;
    tick(): Promise<void>;
    start(): () => void;
    check(): Promise<void>;
    private get;
    private load;
    private lts;
    inspect(source: UpdateSource): Promise<Finding>;
    private advisories;
    private performCheck;
    private analysisFingerprint;
    private changes;
    private baseReport;
    analyze(): Promise<void>;
    private apiSettings;
    private completeReport;
    private performAnalysis;
    ignore(fingerprints: string[]): void;
    notify(testChannel?: 'mail' | 'push'): Promise<void>;
    private deliver;
    handle(req: IncomingMessage, res: ServerResponse, prefix: string): Promise<boolean>;
}
