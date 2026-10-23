// 备份与迁移：把所有该备份的东西打成一个 .tar.gz，导入时一键还原。
// 包里有：人格稿和历史、核心记忆和历史、日记和月度总览、记忆库（数据库，含向量、指纹）、主人私聊的消息存档和它引用的图片、
// 插件二的设置（不含任何 Key）、一份说明清单 manifest.json（版本、时间、各种数量、向量模型、每个文件的 SHA-256）。
// 不进备份：别人的私聊和群聊的存档（数据库里删掉）、dsh 的会话日志。
// 导入：先解开、核对校验值、给你看清单；你确认后先自动备份当前数据，再在插件重新加载时替换（数据库在用着时不能直接换）。

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export const BACKUP_FORMAT = 'dsh-companion-backup'
export const BACKUP_FORMAT_VERSION = 1
/** 进备份的文件夹（数据目录下） */
const DIRS = ['persona', 'core', 'diary']
/** 导入时整体替换的东西 */
const REPLACED = ['persona', 'core', 'diary', 'media', 'companion.db', 'companion.db-wal', 'companion.db-shm']

export interface Manifest {
  format: typeof BACKUP_FORMAT
  formatVersion: number
  plugin: string
  schema: number
  createdAt: number
  reason: 'auto' | 'manual' | 'before-import'
  counts: { memories: number; diaryDays: number; months: number; archiveMessages: number; media: number }
  range: { from?: number; to?: number }
  embed: { model?: string; dim?: number }
  settings: Record<string, unknown>
  files: Array<{ path: string; sha256: string; size: number }>
}

export interface BackupInfo { name: string; size: number; createdAt: number; reason?: string }

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 10 * 60_000, maxBuffer: 4 * 1024 * 1024 }, (error, _out, stderr) => {
      if (error) reject(new Error(cmd + ' 失败：' + (String(stderr).trim().slice(0, 300) || error.message)))
      else resolve()
    })
  })
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function walk(root: string, dir = root): string[] {
  const out: string[] = []
  if (!existsSync(dir)) return out
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(root, p))
    else if (e.isFile()) out.push(relative(root, p).split(sep).join('/'))
  }
  return out
}

/** 文件名里的时间用服务器本地时间（YYYYMMDD-HHMMSS） */
const stamp = (t: number): string => {
  const d = new Date(t)
  const p = (n: number): string => String(n).padStart(2, '0')
  return '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds())
}

export interface CreateOptions {
  dataDir: string
  db: DatabaseSync
  outDir: string
  reason: Manifest['reason']
  plugin: string
  schema: number
  settings: Record<string, unknown>
  embed: Manifest['embed']
  keep: number
  now?: number
}

/** 打一个备份包，返回文件名。超过 keep 份的旧的（同类：自动的只删自动的）删掉。 */
export async function createBackup(o: CreateOptions): Promise<{ name: string; manifest: Manifest }> {
  const now = o.now ?? Date.now()
  mkdirSync(o.outDir, { recursive: true })
  const staging = join(o.outDir, '.tmp-' + now.toString(36) + Math.random().toString(36).slice(2, 6))
  mkdirSync(staging, { recursive: true })
  try {
    for (const d of DIRS) if (existsSync(join(o.dataDir, d))) cpSync(join(o.dataDir, d), join(staging, d), { recursive: true })
    // 数据库：在线拷一份（VACUUM INTO 不影响正在用的），再删掉不进备份的别人的存档
    const dbPath = join(staging, 'companion.db')
    o.db.exec("VACUUM INTO '" + dbPath.replace(/'/g, "''") + "'")
    const copy = new DatabaseSync(dbPath)
    let archiveMessages = 0
    let range: Manifest['range'] = {}
    let memories = 0
    const media: string[] = []
    try {
      copy.exec("DELETE FROM messages WHERE umo NOT IN (SELECT substr(key, 5) FROM cursors WHERE key LIKE 'cat:%' AND value = 1)")
      copy.exec("DELETE FROM meta WHERE key LIKE 'carry:%' OR key LIKE 'proactive:%'")
      archiveMessages = Number((copy.prepare('SELECT COUNT(*) AS n FROM messages').get() as { n: number }).n)
      const r = copy.prepare('SELECT MIN(time) AS a, MAX(time) AS b FROM messages').get() as { a: number | null; b: number | null }
      range = { ...(r.a !== null ? { from: Number(r.a) } : {}), ...(r.b !== null ? { to: Number(r.b) } : {}) }
      memories = Number((copy.prepare('SELECT COUNT(*) AS n FROM memories').get() as { n: number }).n)
      for (const row of copy.prepare("SELECT segments FROM messages WHERE segments LIKE '%_local%'").all() as Array<{ segments: string }>) {
        for (const m of row.segments.matchAll(/"_local":"([0-9a-f]{64}\.[a-z0-9]+)"/g)) if (!media.includes(m[1])) media.push(m[1])
      }
      copy.exec('VACUUM')
    } finally {
      copy.close()
    }
    for (const name of media) {
      const src = join(o.dataDir, 'media', name)
      if (!existsSync(src)) continue
      mkdirSync(join(staging, 'media'), { recursive: true })
      cpSync(src, join(staging, 'media', name))
    }
    writeFileSync(join(staging, 'settings.json'), JSON.stringify(o.settings, null, 2))
    const diaryFiles = walk(join(staging, 'diary'))
    const files = walk(staging).map(path => ({ path, sha256: sha256(join(staging, path)), size: statSync(join(staging, path)).size }))
    const manifest: Manifest = {
      format: BACKUP_FORMAT, formatVersion: BACKUP_FORMAT_VERSION, plugin: o.plugin, schema: o.schema, createdAt: now, reason: o.reason,
      counts: { memories, diaryDays: diaryFiles.filter(f => !f.startsWith('monthly/')).length, months: diaryFiles.filter(f => f.startsWith('monthly/')).length, archiveMessages, media: media.length },
      range, embed: o.embed, settings: o.settings, files,
    }
    writeFileSync(join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2))
    const name = 'companion-' + (o.reason === 'auto' ? 'auto' : o.reason === 'before-import' ? 'before-import' : 'manual') + '-' + stamp(now) + '.tar.gz'
    const tmp = join(o.outDir, name + '.part')
    await run('tar', ['-czf', tmp, '-C', staging, '.'])
    renameSync(tmp, join(o.outDir, name))
    prune(o.outDir, o.keep)
    return { name, manifest }
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
}

/** 备份文件列表，新的在前。 */
export function listBackups(outDir: string): BackupInfo[] {
  if (!existsSync(outDir)) return []
  return readdirSync(outDir).filter(n => /^companion-[a-z-]+-\d{8}-\d{6}\.tar\.gz$/.test(n)).map(name => {
    const st = statSync(join(outDir, name))
    const reason = /^companion-(auto|manual|before-import)-/.exec(name)?.[1]
    return { name, size: st.size, createdAt: st.mtimeMs, ...(reason ? { reason } : {}) }
  }).sort((a, b) => b.name.slice(-22).localeCompare(a.name.slice(-22)))
}

/** 每一类（自动、手动、导入前）各留 keep 份。 */
export function prune(outDir: string, keep: number): void {
  const byReason = new Map<string, BackupInfo[]>()
  for (const b of listBackups(outDir)) byReason.set(b.reason ?? '', [...(byReason.get(b.reason ?? '') ?? []), b])
  for (const list of byReason.values()) for (const b of list.slice(Math.max(1, keep))) rmSync(join(outDir, b.name), { force: true })
}

export function safeBackupName(name: string): boolean {
  return /^companion-[a-z-]+-\d{8}-\d{6}\.tar\.gz$/.test(name)
}

/** 解开一个备份包、核对清单和校验值。返回解开的目录和清单。 */
export async function inspectBackup(file: string, workDir: string): Promise<{ dir: string; manifest: Manifest }> {
  const dir = workDir
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  await run('tar', ['-xzf', file, '-C', dir])
  const mPath = join(dir, 'manifest.json')
  if (!existsSync(mPath)) throw new Error('不是插件二的备份包（没有 manifest.json）')
  const manifest = JSON.parse(readFileSync(mPath, 'utf-8')) as Manifest
  if (manifest.format !== BACKUP_FORMAT) throw new Error('不是插件二的备份包')
  if (manifest.formatVersion > BACKUP_FORMAT_VERSION) throw new Error('备份包是更新版本的插件做的，请先升级插件')
  for (const f of manifest.files) {
    const p = join(dir, f.path)
    if (!p.startsWith(dir + sep)) throw new Error('备份包里有不安全的路径')
    if (!existsSync(p) || sha256(p) !== f.sha256) throw new Error('校验值对不上：' + f.path + '（包可能损坏）')
  }
  return { dir, manifest }
}

/**
 * 插件启动时（打开数据库之前）调用：有待导入的数据就替换进来。
 * 旧数据先挪到 .replaced-<时间>，成功后删掉（导入前已经自动备份过）。返回导入的清单（没有待导入时 undefined）。
 */
export function applyPendingImport(dataDir: string): Manifest | undefined {
  const pending = join(dataDir, '.pending-import')
  if (!existsSync(join(pending, 'manifest.json'))) return undefined
  const manifest = JSON.parse(readFileSync(join(pending, 'manifest.json'), 'utf-8')) as Manifest
  const aside = join(dataDir, '.replaced-' + Date.now().toString(36))
  mkdirSync(aside, { recursive: true })
  for (const name of REPLACED) if (existsSync(join(dataDir, name))) renameSync(join(dataDir, name), join(aside, name))
  try {
    for (const name of REPLACED) if (existsSync(join(pending, name))) renameSync(join(pending, name), join(dataDir, name))
  } catch (e) {
    // 放回去
    for (const name of REPLACED) if (existsSync(join(aside, name)) && !existsSync(join(dataDir, name))) renameSync(join(aside, name), join(dataDir, name))
    throw e
  }
  rmSync(pending, { recursive: true, force: true })
  rmSync(aside, { recursive: true, force: true })
  return manifest
}
