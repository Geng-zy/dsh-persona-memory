type Load = (url: string) => Promise<{
    text: string;
    json: any;
}>;
export declare function normalizeDocument(body: string): string;
export declare function readableDocument(text: string): boolean;
export declare function publicRedirectAllowed(from: URL, to: URL): boolean;
export declare function upstreamRequestError(error: unknown): string;
export declare function officialDocument(url: string, load: Load): Promise<{
    text: string;
    method: string;
}>;
export {};
