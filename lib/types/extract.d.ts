import { type Memory, type MemoryKind } from './memory.js';
export interface ModelTarget {
    provider: string;
    model: string;
}
export interface LlmLike {
    stream(options: Record<string, unknown>): AsyncIterable<unknown>;
}
/** 发一条提示词，拿回文字。 */
export declare function complete(llm: LlmLike, target: ModelTarget, prompt: string, maxTokens?: number, signal?: AbortSignal): Promise<string>;
export interface Extracted {
    content: string;
    kind: MemoryKind;
    importance: number;
    replaces?: string;
}
/** 「这段聊天是谁的」说明，写进提示词。 */
export declare function whoText(category: 'master' | 'private' | 'group', id?: string): string;
export declare function extractionPrompt(transcript: readonly string[], who: string, existing: readonly string[]): string;
export declare function parseExtracted(text: string): Extracted[];
export declare function cleanupPrompt(items: readonly Memory[]): string;
export declare function parseCleanup(text: string, allowed: ReadonlySet<number>): Array<{
    id: number;
    reason: string;
}>;
