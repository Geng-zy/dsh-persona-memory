import type { Context } from '@deepseek-ai/cordis';
import type { SnowlumaService, Config } from '../index.js';
export declare function applyQqFeatures(ctx: Context, get: <K extends keyof Config>(key: K) => Config[K], log: (level: 'debug' | 'info' | 'warn' | 'error', message: string) => void, localBridge: SnowlumaService): Promise<void>;
