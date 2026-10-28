export interface EnvironmentSchedule {
    schedule: 'off' | 'daily' | 'weekly';
    time: string;
    weekday: number;
    keep: number;
    timezone: string;
}
export declare const environmentName: (name: string) => boolean;
export declare class EnvironmentBackup {
    readonly dir: string;
    constructor(dir: string);
    available(): boolean;
    state(): Record<string, unknown>;
    schedule(value: EnvironmentSchedule): void;
    request(): void;
    file(name: string): string | undefined;
}
