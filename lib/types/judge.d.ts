import type { JudgePayload } from './bridge.js';
export declare function judgePrompt(payload: JudgePayload): string;
export declare function parseJudge(text: string): boolean;
export declare function judgeResponse(llm: {
    stream(options: Record<string, unknown>): AsyncIterable<unknown>;
} | undefined, model: {
    provider: string;
    model: string;
}, payload: JudgePayload, signal: AbortSignal): Promise<boolean>;
