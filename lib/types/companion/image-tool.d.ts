import type { ImageGenerator, GeneratedImage } from '../image-generation.js';
export interface ImageToolDeps {
    generator: ImageGenerator;
    allowed(sessionId: string): boolean;
    deliver(sessionId: string, images: GeneratedImage[], signal: AbortSignal): Promise<boolean>;
    attach(image: GeneratedImage): Promise<any>;
}
/** Always registered for managed sessions: execution checks live settings, identity and allowlists. */
export declare function imageTool(deps: ImageToolDeps): import("@deepseek-ai/dsh-tools").ToolDefinition;
