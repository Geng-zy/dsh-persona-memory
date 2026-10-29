import { mkdir, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
export function defaultQqWorkspacePath() {
    return join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'workspaces', 'QQ');
}
/** 安装/启用时注册目录；同一路径由 dsh 复用工作区，避免重复安装产生重复项。 */
export async function ensureQqWorkspace(registry, configuredPath = '') {
    const path = configuredPath.trim() || defaultQqWorkspacePath();
    if (!isAbsolute(path))
        throw new Error('QQ工作区位置必须填写绝对路径');
    await mkdir(path, { recursive: true, mode: 0o700 });
    return registry.create(await realpath(path), 'QQ');
}
import { createHash } from 'node:crypto';
/** 不改原会话文件；逻辑复制、验证、归档成功后，调用方才提交QQ映射。 */
export class QqWorkspaceManager {
    deps;
    current;
    tasks = new Map();
    constructor(deps) {
        this.deps = deps;
    }
    snapshot() { return { id: this.current?.id, path: this.path, sessionCount: this.current?.sessionIds?.length ?? 0 }; }
    get path() { return this.current?.path ?? (this.deps.configuredPath().trim() || defaultQqWorkspacePath()); }
    async initialize() { if (this.current && this.tasks.size)
        return; this.current = await ensureQqWorkspace(this.deps.registry, this.deps.configuredPath()); }
    async attach(id) {
        const stored = await this.deps.persistence.stat(id);
        if (stored) {
            if (!stored.header.cwd)
                throw new Error('QQ会话缺少工作目录');
            const ws = await this.deps.registry.create(stored.header.cwd, 'QQ');
            await ws.attachSession(id);
            return;
        }
        if (!this.current)
            await this.initialize();
        await this.current.attachSession(id);
    }
    prepare(id) {
        const pending = this.tasks.get(id);
        if (pending)
            return pending;
        const task = this.copy(id).finally(() => this.tasks.delete(id));
        this.tasks.set(id, task);
        return task;
    }
    async copy(id) {
        await this.initialize();
        const ws = this.current;
        const redirect = this.deps.memo?.get('migrated:' + id);
        if (redirect && redirect !== id && await this.deps.persistence.stat(redirect)) {
            const current = await this.prepare(redirect);
            this.deps.replace(id, current);
            return current;
        }
        const stored = await this.deps.persistence.stat(id);
        if (!stored)
            return id;
        if (stored.header.cwd === ws.path) {
            await ws.attachSession(id);
            return id;
        }
        if (this.deps.busy(id))
            return id;
        const destination = id + '-ws-' + createHash('sha256').update(ws.path).digest('hex').slice(0, 12);
        const memoKey = id + '@' + ws.path;
        const saved = this.deps.memo?.get(memoKey);
        const original = saved ? JSON.parse(saved) : { archived: this.deps.registry.archivedSessionIds.includes(id), done: false };
        this.deps.memo?.set(memoKey, JSON.stringify(original));
        const source = await this.deps.persistence.open(id, 'read');
        let events, header, inheritedEventCount;
        try {
            events = (await source.read()).events;
            header = { ...source.header, id: destination, cwd: ws.path };
            inheritedEventCount = source.inheritedEventCount;
        }
        finally {
            await source.close();
        }
        const copied = events.map(event => {
            const stored = event;
            if (stored.type !== 'session-log-deepseek/delivery-accepted')
                return event;
            const data = stored.data;
            return data.sessionId === id ? { ...stored, data: { ...data, sessionId: destination } } : event;
        });
        if (!await this.deps.persistence.stat(destination)) {
            const target = await this.deps.persistence.create(header, { inheritedEventCount });
            try {
                await target.append(copied);
                await target.flush();
            }
            finally {
                await target.close();
            }
        }
        const check = await this.deps.persistence.open(destination, 'read');
        let missing = [];
        try {
            const restored = await check.read();
            // A stopped process may leave a valid prefix. Resume only an exact prefix;
            // divergent data is retained and refused instead of being overwritten.
            if (check.header.cwd !== ws.path || check.inheritedEventCount !== inheritedEventCount || restored.events.length > copied.length || JSON.stringify(restored.events) !== JSON.stringify(copied.slice(0, restored.events.length)))
                throw new Error('QQ工作区副本校验失败，原会话和映射保持不变');
            missing = copied.slice(restored.events.length);
        }
        finally {
            await check.close();
        }
        if (missing.length) {
            const target = await this.deps.persistence.open(destination, 'write');
            try {
                await target.append(missing);
                await target.flush();
            }
            finally {
                await target.close();
            }
            const verified = await this.deps.persistence.open(destination, 'read');
            try {
                if (JSON.stringify((await verified.read()).events) !== JSON.stringify(copied))
                    throw new Error('QQ工作区副本校验失败，原会话和映射保持不变');
            }
            finally {
                await verified.close();
            }
        }
        if (this.deps.busy(id))
            throw new Error('原QQ会话开始运行，本次不切换映射，空闲后重试');
        await ws.attachSession(destination);
        await this.deps.registry.archiveSession(id);
        if (original.archived)
            await this.deps.registry.archiveSession(destination);
        this.deps.replace(id, destination);
        this.deps.memo?.set(memoKey, JSON.stringify({ ...original, done: true }));
        this.deps.memo?.set('migrated:' + id, destination);
        return destination;
    }
    async migrateAll() {
        await this.initialize();
        let migrated = 0, deferred = 0;
        for (const { header } of await this.deps.persistence.list()) {
            const id = String(header.id);
            if (!this.deps.owned(id) || this.deps.memo?.get('migrated:' + id) || header.cwd === this.path)
                continue;
            if (this.deps.busy(id)) {
                deferred++;
                continue;
            }
            if (await this.prepare(id) !== id)
                migrated++;
        }
        return { migrated, deferred };
    }
}
