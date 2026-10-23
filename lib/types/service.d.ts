import type { ContextRule, Scope } from './rules.js';
export interface ContextPolicy {
    scope: Scope;
    rule: ContextRule;
    /** 上下文到模型上限的百分之多少就处理 */
    thresholdPercent: number;
    /** LLM 压缩用哪个模型；不填用当前会话的 */
    summaryModel?: {
        provider: string;
        model: string;
    };
}
/** 截断或压缩之前发出的通知（阶段 2 的记忆在这里先把要紧内容写进记忆）。 */
export interface BeforeCompactPayload {
    sessionId: string;
    scope: Scope;
    mode: 'truncate' | 'llm';
    reason: 'rounds' | 'pressure' | 'overflow' | 'manual';
    /** 要处理掉的那几轮的文字（按时间顺序，[角色] 内容） */
    transcript: string[];
}
export interface CompanionService {
    /** 这个会话该怎么管上下文；返回 undefined 表示这个会话不归插件二管（不生效的预设），按 dsh 自带的方式压缩 */
    contextPolicy(sessionId: string, presetId?: string): ContextPolicy | undefined;
    /** 处理之前先通知（出错不影响处理） */
    beforeCompact(payload: BeforeCompactPayload): Promise<void>;
    /** 记一条日志（设置页能看到最近的） */
    log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        companion: CompanionService;
    }
    interface Events {
        /** 截断或压缩上下文之前（serial，最多等 60 秒） */
        'companion/before-compact'(payload: BeforeCompactPayload): void | Promise<void>;
    }
}
