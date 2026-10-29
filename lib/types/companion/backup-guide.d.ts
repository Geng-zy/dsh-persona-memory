export interface FileDescription {
    path: string;
    format: string;
    description: string;
    restoreItem: string | null;
    migration: string[];
    fields?: Record<string, {
        type: string;
        description: string;
    }>;
}
export declare function describeSettings(schema: unknown): Record<string, string>;
export declare function writeBackupGuide(root: string, o: {
    owner: string;
    plugin: string;
    createdAt: number;
    items: readonly string[];
    payload: readonly string[];
    settingDescriptions?: Record<string, string>;
}): Record<string, FileDescription>;
