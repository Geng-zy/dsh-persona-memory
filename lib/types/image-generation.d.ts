export declare const IMAGE_PROVIDERS: {
    readonly openai: readonly ['OpenAI / compatible Images', 'https://api.openai.com/v1', 'gpt-image-1'];
    readonly azure: readonly ['Azure OpenAI Images', '', ''];
    readonly modelscope: readonly ['ModelScope 魔搭', 'https://api-inference.modelscope.cn/v1', 'Qwen/Qwen-Image-2.1'];
    readonly dashscope: readonly ['Alibaba DashScope / Qwen / Wan', 'https://dashscope.aliyuncs.com/api/v1', 'qwen-image-plus'];
    readonly gemini: readonly ['Google Gemini image', 'https://generativelanguage.googleapis.com/v1beta', ''];
    readonly imagen: readonly ['Google Imagen (Gemini API)', 'https://generativelanguage.googleapis.com/v1beta', ''];
    readonly vertex: readonly ['Google Vertex Imagen (Bearer token)', '', ''];
    readonly openrouter: readonly ['OpenRouter image chat', 'https://openrouter.ai/api/v1', ''];
    readonly bfl: readonly ['Black Forest Labs FLUX', 'https://api.bfl.ai/v1', 'flux-2-pro'];
    readonly fal: readonly ['fal.ai queue', 'https://queue.fal.run', 'fal-ai/flux/dev'];
    readonly replicate: readonly ['Replicate predictions', 'https://api.replicate.com/v1', 'black-forest-labs/flux-schnell'];
    readonly stability: readonly ['Stability AI', 'https://api.stability.ai/v2beta', 'core'];
    readonly ideogram: readonly ['Ideogram v3', 'https://api.ideogram.ai', 'ideogram-v3'];
    readonly huggingface: readonly ['Hugging Face hf-inference', 'https://router.huggingface.co/hf-inference/models', ''];
    readonly a1111: readonly ['AUTOMATIC1111 / Forge API', 'http://127.0.0.1:7860', ''];
    readonly comfyui: readonly ['ComfyUI API workflow', 'http://127.0.0.1:8188', ''];
    readonly custom: readonly ['Custom HTTP / async JSON', '', ''];
    readonly command: readonly ['Local program / Diffusers / cloud CLI', '', ''];
};
export type ImageProvider = keyof typeof IMAGE_PROVIDERS;
export interface ImageSettings {
    enabled: boolean;
    provider: ImageProvider;
    baseUrl: string;
    apiKey: string;
    model: string;
    options: string;
    command: string;
    timeoutSeconds: number;
    maxImages: number;
    maxMB: number;
    keepDays: number;
}
export interface ImageRequest {
    prompt: string;
    negativePrompt?: string;
    size?: string;
    count?: number;
}
export interface GeneratedImage {
    id: string;
    mediaType: string;
    bytes: number;
    createdAt: number;
    path: string;
}
export interface GenerationResult {
    images: GeneratedImage[];
    warning?: string;
}
type Json = any;
export declare function imageOptions(text: string): Record<string, Json>;
/** Exact placeholders retain numeric/object types; interpolated text is never evaluated as code. */
export declare function imageTemplate(value: Json, vars: Record<string, Json>): Json;
export declare function safeProviderError(error: unknown, key: string): string;
export declare class ImageGenerator {
    readonly dir: string;
    readonly settings: () => ImageSettings;
    private active;
    constructor(dir: string, settings: () => ImageSettings);
    get activeCount(): number;
    dispose(): void;
    run(request: ImageRequest, signal?: AbortSignal): Promise<GenerationResult>;
    file(id: string): string | undefined;
    list(): Array<Omit<GeneratedImage, 'path'>>;
    private prune;
}
export {};
