/** Isolated report API transport. Only the public report prompt enters the configured service. */
export interface ReportApi {
    url: string;
    key: string;
    model: string;
    protocol: 'openai' | 'anthropic';
}
export declare function reportApiModels(api: ReportApi, signal: AbortSignal, doFetch?: typeof fetch): Promise<string[]>;
export declare function reportApiComplete(api: ReportApi, prompt: string, maxTokens: number, signal: AbortSignal, doFetch?: typeof fetch): Promise<string>;
