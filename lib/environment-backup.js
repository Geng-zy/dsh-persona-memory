// 完整环境备份由独立系统服务执行；插件仅提交固定任务、读取状态和下载，不运行 sudo。
import { closeSync, existsSync, lstatSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
export const environmentName = (name) => /^environment-\d{8}-\d{6}-[a-f0-9]{8}\.tar\.gz$/.test(name);
const regular = (path) => existsSync(path) && lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink();
export class EnvironmentBackup {
    dir;
    constructor(dir) {
        this.dir = dir;
    }
    available() { return regular(join(this.dir, 'helper.json')) && existsSync(join(this.dir, 'inbox')); }
    state() {
        if (!this.available())
            return { available: false };
        const path = join(this.dir, 'status.json');
        let state = {};
        try {
            state = regular(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
        }
        catch {
            state = { phase: 'failed', error: '完整环境备份状态不可读，请检查系统备份服务' };
        }
        return { ...state, available: true, pending: regular(join(this.dir, 'inbox', 'request.json')) };
    }
    schedule(value) {
        if (!this.available())
            return;
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time))
            throw new Error('完整环境备份时间需要 HH:MM 格式（00:00–23:59）');
        const path = join(this.dir, 'inbox', 'schedule.json');
        const text = JSON.stringify(value);
        if (regular(path) && readFileSync(path, 'utf8') === text)
            return;
        const tmp = path + '.' + randomUUID();
        writeFileSync(tmp, text, { mode: 0o600, flag: 'wx' });
        renameSync(tmp, path);
    }
    request() {
        if (!this.available())
            throw new Error('尚未安装完整环境备份服务');
        const st = this.state();
        if (st.pending || st.phase === 'copying' || st.phase === 'packing')
            throw new Error('已有完整环境备份任务，请等完成后再操作');
        const fd = openSync(join(this.dir, 'inbox', 'request.json'), 'wx', 0o600);
        try {
            writeFileSync(fd, JSON.stringify({ id: randomUUID(), createdAt: Date.now() }));
        }
        finally {
            closeSync(fd);
        }
    }
    file(name) {
        if (!environmentName(name))
            return undefined;
        const path = join(this.dir, 'archives', name);
        return regular(path) ? path : undefined;
    }
}
