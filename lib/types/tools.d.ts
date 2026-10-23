import { type TextDoc } from './docs.js';
export interface ToolDeps {
    persona: TextDoc;
    coreMaster: TextDoc;
    corePublic: TextDoc;
    /** 这个会话现在还算不算主人的（执行时再查一次） */
    isMaster(sessionId: string): boolean;
    /** 核心记忆最多多少字节 */
    coreMaxBytes(): number;
    log(level: 'info' | 'warn', message: string): void;
}
export declare function personaTool(deps: ToolDeps): import("@deepseek-ai/dsh-tools").ToolDefinition;
export declare function coreTool(deps: ToolDeps): import("@deepseek-ai/dsh-tools").ToolDefinition;
