export declare const ltsLabel: (s: string) => boolean;
export declare const previewLabel: (s: string) => boolean;
export declare function releaseVersion(tag: string): string | null;
export declare function npmLtsVersions(data: any): string[];
export declare function ltsCycles(data: any, now: number, product?: string): any[];
export declare const inCycle: (v: string, cycle: string) => boolean;
