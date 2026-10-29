// 备份与迁移：把勾选的东西打成一个 .tar.gz，导入时也按勾选还原。
// 能备份的（ITEMS）：人格和核心记忆现稿、日记和月度总览、记忆库（长期记忆、向量、关系网、指纹）、
// 主人私聊的消息存档和图片、主人 QQ 私聊的 dsh 会话及引用附件、插件二 / 插件一 / dsh 其他插件的设置（配置不含 Key 和 Token：
// 从 dsh 设置服务读，标了 role('secret') 的字段它会自己去掉）。另有一份清单 manifest.json（版本、时间、各种数量、每个文件的 SHA-256）。
// 普通包不包含配置密钥、其他私聊或群聊的存档和 dsh 会话、网页会话及运行环境。原始会话可能包含聊天中出现的敏感内容。
// 导入：先解开、核对校验值、给你看清单和勾选；确认后先自动备份当前全部数据，设置马上套用，
// 文件和数据库在插件重新加载时替换（数据库在用着时不能动）。数据库按勾选的部分换表，没勾的部分保持原样。

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import {writeBackupGuide} from './backup-guide.js'
import { Archive } from './archive.js'
import { TextDoc } from './docs.js'
import { exportMasterSessions, importMasterSessions, type MasterSessionServices } from './master-sessions.js'

export const BACKUP_FORMAT = 'dsh-companion-backup'
export const BACKUP_FORMAT_VERSION = 3

/** 能备份的东西，顺序就是设置页里的顺序 */
export const ITEMS = ['persona', 'core', 'diary', 'memory', 'settingsCompanion'] as const
export type BackupItem = 'persona'|'core'|'diary'|'memory'|'archiveMaster'|'sessionsMaster'|'settingsCompanion'|'settingsBridge'|'settingsDsh'
/** 默认勾选：主人原始会话需自行勾选（旧设置中已选其他存档时迁移为此项） */
export const DEFAULT_ITEMS: BackupItem[] = [...ITEMS]
/** 旧版（格式 1）的包里固定有的 */
const LEGACY_ITEMS: BackupItem[] = ['persona', 'core', 'diary', 'memory', 'archiveMaster', 'settingsCompanion']
export const SETTINGS_ITEMS: BackupItem[] = ['settingsCompanion', 'settingsBridge', 'settingsDsh']
const DIR_ITEMS: BackupItem[] = ['persona', 'core', 'diary']
/** 人格和核心记忆只带现在的文件，不带历史版本；还原时照常写入（被换掉的那版进历史） */
const DOC_FILES: Record<string, Array<[file: string, history: string]>> = {
  persona: [['persona/persona.md', 'persona/history']],
  core: [['core/master.md', 'core/history-master'], ['core/public.md', 'core/history-public'], ['core/group.md','core/history-group'], ['core/private.md','core/history-private']],
}
const DB_ITEMS: BackupItem[] = ['memory']
/** 记忆库的表（换「记忆库」时整表换） */
const MEMORY_TABLES = ['memories', 'tombstones', 'consolidations', 'graph_entities', 'graph_edges', 'graph_mentions', 'graph_done']
/** 主人的会话：organizer 记的分类是 1 */

export function cleanItems(list: unknown): BackupItem[] {
  const want = new Set(Array.isArray(list) ? list.map(String) : [])
  return ITEMS.filter(i => want.has(i))
}
/** 设置项的旧选择迁移；不用于解释旧备份包的内容。 */
export function configuredItems(list: unknown): BackupItem[] {
  return cleanItems(Array.isArray(list) ? list.map(i => i === 'archiveOthers' ? 'sessionsMaster' : i) : list)
}
/** 包里有哪些（旧包没写就按旧版固定内容算） */
export function itemsOf(m: Manifest): BackupItem[] {
  if(m.owner && m.owner!=='dsh-persona-memory')return []
  return Array.isArray(m.items) ? cleanItems(m.items) : LEGACY_ITEMS
}

/** Validated payload files grouped by the restore operation that consumes them. A DB may serve two independent table selections. */
export function restoreContents(m: Manifest): Array<{ item: BackupItem; files: Array<{ path: string; size: number }> }> {
  return itemsOf(m).map(item => ({ item, files: m.files.filter(f => {
    if (item === 'persona' || item === 'core') return DOC_FILES[item].some(([path]) => path === f.path)
    if (item === 'diary') return f.path.startsWith('diary/')
    if (item === 'memory') return f.path === 'companion.db'
    if (item === 'archiveMaster') return f.path === 'companion.db' || f.path.startsWith('media/')
    if (item === 'sessionsMaster') return f.path === 'master-sessions.json'
    return Object.entries(SETTINGS_FILES).some(([name, value]) => value === item && f.path === 'settings/' + name + '.json') || item === 'settingsCompanion' && f.path === 'settings.json'
  }).map(({ path, size }) => ({ path, size })) }))
}

/** 设置文件：settings/<名字>.json，内容是 { ns, user }（user = 用户改过的字段，已去掉 Key） */
export interface SavedSettings { ns: string; user: Record<string, unknown> }
export const SETTINGS_FILES: Record<string, BackupItem> = { 'companion-core': 'settingsCompanion', 'snowluma-bridge': 'settingsBridge', dsh: 'settingsDsh' }

export interface Manifest {
  owner?: string
  format: typeof BACKUP_FORMAT
  formatVersion: number
  plugin: string
  schema: number
  createdAt: number
  reason: 'auto' | 'manual' | 'before-import'
  /** 包里有哪些（格式 2 起有） */
  items?: BackupItem[]
  /** archiveMessages 是主人的存档条数；othersMessages 是别人的（格式 2 起有） */
  counts: { memories: number; diaryDays: number; months: number; archiveMessages: number; media: number; masterSessions?: number; othersMessages?: number }
  range: { from?: number; to?: number }
  embed: { model?: string; dim?: number }
  settings: Record<string, unknown>
  files: Array<{ path: string; sha256: string; size: number; description?:string; restoreItem?:string|null }>
}

export interface BackupInfo { name: string; size: number; createdAt: number; reason?: string }

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 10 * 60_000, maxBuffer: 4 * 1024 * 1024 }, (error, _out, stderr) => {
      if (error) reject(new Error(cmd + ' 失败：' + (String(stderr).trim().slice(0, 300) || error.message)))
      else resolve(_out)
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
  /** 备份哪些；不给就是默认的 */
  items?: readonly BackupItem[]
  /** 设置文件（名字见 SETTINGS_FILES），只放勾选了的 */
  settingDescriptions?:Record<string,string>
  settingsFiles?: Record<string, unknown>
  sessionServices?: MasterSessionServices
  now?: number
}

/** 打一个备份包，返回文件名。成功生成后，所有类型合计仅保留最新 keep 份。 */
export async function createBackup(o: CreateOptions): Promise<{ name: string; manifest: Manifest }> {
  const now = o.now ?? Date.now()
  mkdirSync(o.outDir, { recursive: true })
  const staging = join(o.outDir, '.tmp-' + now.toString(36) + Math.random().toString(36).slice(2, 6))
  mkdirSync(staging, { recursive: true })
  const items = new Set<BackupItem>(cleanItems(o.items ?? DEFAULT_ITEMS))
  try {
    if(!items.size)throw new Error('至少选择一项属于当前插件的备份内容')
    for (const d of DIR_ITEMS) {
      if (!items.has(d)) continue
      const files = DOC_FILES[d]
      if (files === undefined) { if (existsSync(join(o.dataDir, d))) cpSync(join(o.dataDir, d), join(staging, d), { recursive: true }); continue }
      for (const [file] of files) {
        if (!existsSync(join(o.dataDir, file))) continue
        mkdirSync(join(staging, d), { recursive: true })
        cpSync(join(o.dataDir, file), join(staging, file))
      }
    }
    let archiveMessages = 0
    const masterSessions = items.has('sessionsMaster') ? await exportMasterSessions(staging, o.sessionServices ?? {}) : 0
    let range: Manifest['range'] = {}
    let memories = 0
    const media = new Set<string>()
    if (DB_ITEMS.some(i => items.has(i))) {
      // 数据库：在线拷一份（VACUUM INTO 不影响正在用的），再删掉没勾的部分
      const dbPath = join(staging, 'companion.db')
      o.db.exec("VACUUM INTO '" + dbPath.replace(/'/g, "''") + "'")
      const copy = new DatabaseSync(dbPath)
      try {
        copy.exec('DROP TABLE IF EXISTS messages; DROP TABLE IF EXISTS retired;')
        copy.exec('DELETE FROM journal')
        copy.exec("DELETE FROM meta WHERE key LIKE 'carry:%' OR key LIKE 'proactive:%'")
        memories=Number((copy.prepare('SELECT COUNT(*) AS n FROM memories').get() as {n:number}).n)
        copy.exec('VACUUM; PRAGMA journal_mode=DELETE;')
      } finally {
        copy.close()
      }
    }
    for (const name of media) {
      const src = join(o.dataDir, 'media', name)
      if (!existsSync(src)) continue
      mkdirSync(join(staging, 'media'), { recursive: true })
      cpSync(src, join(staging, 'media', name))
    }
    if (items.has('settingsCompanion')) writeFileSync(join(staging, 'settings.json'), JSON.stringify(o.settings, null, 2))
    for (const [name, value] of Object.entries(o.settingsFiles ?? {})) {
      if (SETTINGS_FILES[name] === undefined || !items.has(SETTINGS_FILES[name])) continue
      mkdirSync(join(staging, 'settings'), { recursive: true })
      writeFileSync(join(staging, 'settings', name + '.json'), JSON.stringify(value, null, 2))
    }
    const diaryFiles = walk(join(staging, 'diary'))
    const descriptions=writeBackupGuide(staging,{owner:'dsh-persona-memory',plugin:o.plugin,createdAt:now,items:ITEMS.filter(i=>items.has(i)),payload:walk(staging),settingDescriptions:o.settingDescriptions})
    const files = walk(staging).map(path => ({ path, sha256: sha256(join(staging, path)), size: statSync(join(staging, path)).size, description:descriptions[path]?.description,restoreItem:descriptions[path]?.restoreItem??null }))
    const manifest: Manifest = {
      owner: 'dsh-persona-memory', format: BACKUP_FORMAT, formatVersion: BACKUP_FORMAT_VERSION, plugin: o.plugin, schema: o.schema, createdAt: now, reason: o.reason,
      items: ITEMS.filter(i => items.has(i)),
      counts: { memories, diaryDays: diaryFiles.filter(f => !f.startsWith('monthly/')).length, months: diaryFiles.filter(f => f.startsWith('monthly/')).length, archiveMessages, media: media.size, masterSessions },
      range, embed: o.embed, settings: items.has('settingsCompanion') ? o.settings : {}, files,
    }
    writeFileSync(join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2))
    const name = 'persona-memory-' + (o.reason === 'auto' ? 'auto' : o.reason === 'before-import' ? 'before-import' : 'manual') + '-' + stamp(now) + '.tar.gz'
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
  return readdirSync(outDir).filter(n => /^(?:companion|persona-memory|qq-gateway)-[a-z-]+-\d{8}-\d{6}\.tar\.gz$/.test(n)).map(name => {
    const st = statSync(join(outDir, name))
    const reason = /^(?:companion|persona-memory|qq-gateway)-(auto|manual|before-import)-/.exec(name)?.[1]
    return { name, size: st.size, createdAt: st.mtimeMs, ...(reason ? { reason } : {}) }
  }).sort((a, b) => b.name.slice(-22).localeCompare(a.name.slice(-22)))
}

/** 自动、手动、导入前备份合计保留最新 keep 份；只处理列表中的正式备份包。 */
export function prune(outDir: string, keep: number): void {
  for (const b of listBackups(outDir).slice(Math.max(1, Math.min(5, keep)))) rmSync(join(outDir, b.name), { force: true })
}

export function safeBackupName(name: string): boolean {
  return /^(?:companion|persona-memory|qq-gateway)-[a-z-]+-\d{8}-\d{6}\.tar\.gz$/.test(name)
}

/** 解开一个备份包、核对清单和校验值。返回解开的目录和清单。 */
export async function inspectBackup(file: string, workDir: string): Promise<{ dir: string; manifest: Manifest }> {
  const dir = workDir
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  try {
    // Check paths and entry types before extraction, including entries omitted from the manifest.
    const safePath = (path: string): boolean => path.length > 0 && !path.startsWith('/') && !path.includes('\\') && !/[\x00-\x1f\x7f]/.test(path) && !path.split('/').some(p => p === '..' || p === '.')
    const names = (await run('tar', ['-tzf', file])).trimEnd().split('\n').map(p => p.replace(/^\.\//, '').replace(/\/$/, '')).filter(Boolean)
    if (names.some(p => !safePath(p)) || new Set(names).size !== names.length) throw new Error('备份包含不安全或重复的路径')
    const entries = (await run('tar', ['-tvzf', file])).trimEnd().split('\n')
    if (entries.some(line => !/^[-d]/.test(line))) throw new Error('备份包只允许普通文件和目录，不支持链接或特殊文件')
    await run('tar', ['-xzf', file, '-C', dir])
    const mPath = join(dir, 'manifest.json')
    if (!existsSync(mPath)) throw new Error('不是陪伴助手备份包（缺少 manifest.json）')
    const manifest = JSON.parse(readFileSync(mPath, 'utf-8')) as Manifest
    if (manifest.format !== BACKUP_FORMAT) throw new Error('不是陪伴助手备份包')
    if (manifest.formatVersion > BACKUP_FORMAT_VERSION) throw new Error('备份包是更新版本的插件做的，请先升级插件')
    if (!Array.isArray(manifest.files)) throw new Error('备份文件清单无效')
    for (const f of manifest.files) {
      if (typeof f.path !== 'string' || !safePath(f.path) || !/^[a-f0-9]{64}$/.test(f.sha256)) throw new Error('备份文件清单无效')
      const p = join(dir, f.path)
      if (!p.startsWith(dir + sep)) throw new Error('备份包里有不安全的路径')
      if (!existsSync(p) || !statSync(p).isFile() || statSync(p).size !== f.size || sha256(p) !== f.sha256) throw new Error('校验值对不上：' + f.path + '（包可能损坏）')
    }
    const listed = new Set(manifest.files.map(f => f.path))
    if (listed.size !== manifest.files.length || walk(dir).some(p => p !== 'manifest.json' && !listed.has(p))) throw new Error('实际文件与备份清单不一致')
    return { dir, manifest }
  } catch (error) {
    rmSync(dir, { recursive: true, force: true })
    throw error
  }
}

/** 包里的设置文件（只读勾选了的）。 */
export function readSavedSettings(dir: string, items: readonly BackupItem[]): Record<string, SavedSettings | Record<string, SavedSettings>> {
  items=cleanItems(items)
  const out: Record<string, any> = {}
  for (const [name, item] of Object.entries(SETTINGS_FILES)) {
    const p = join(dir, 'settings', name + '.json')
    if (items.includes(item) && existsSync(p)) out[name] = JSON.parse(readFileSync(p, 'utf-8'))
  }
  // 旧版的包只有 settings.json（插件二全部设置的值，没有 Key）
  if (items.includes('settingsCompanion') && out['companion-core'] === undefined && existsSync(join(dir, 'settings.json'))) {
    out['companion-core'] = { ns: 'companion-core', user: JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf-8')) }
  }
  return out
}

/** 确认导入时写进待导入目录：要还原哪些、设置套用的结果（重新加载后显示） */
export interface RestorePlan { items: BackupItem[]; notes?: string[] }

/**
 * 插件启动时（打开数据库之前）调用：有待导入的数据就按勾选还原。
 * 原始会话先建立新日志并切换绑定（旧日志保留），再换数据库（一个事务），再换文件夹（旧的先挪开，失败放回去），图片只补不删。
 * 返回导入的清单和勾选（没有待导入时 undefined）。
 */
export async function applyPendingImport(dataDir: string, historyKeep: () => number = () => 20, sessionServices: MasterSessionServices = {}): Promise<{ manifest: Manifest; plan: RestorePlan } | undefined> {
  const pending = join(dataDir, '.pending-import')
  if (!existsSync(join(pending, 'manifest.json'))) return undefined
  const manifest = JSON.parse(readFileSync(join(pending, 'manifest.json'), 'utf-8')) as Manifest
  const planPath = join(pending, 'restore.json')
  const plan: RestorePlan = existsSync(planPath) ? JSON.parse(readFileSync(planPath, 'utf-8')) as RestorePlan : { items: itemsOf(manifest) }
  plan.items = cleanItems(plan.items).filter(item=>itemsOf(manifest).includes(item))
  if(!plan.items.length)throw new Error('备份中没有属于当前插件的可恢复内容')
  const items = new Set(cleanItems(plan.items).filter(i => itemsOf(manifest).includes(i)))
  if (items.has('sessionsMaster')) await importMasterSessions(pending, sessionServices)
  if (DB_ITEMS.some(i => items.has(i)) && existsSync(join(pending, 'companion.db'))) mergeDb(join(dataDir, 'companion.db'), join(pending, 'companion.db'), items)
  // 人格、核心记忆：只换文件，历史版本留着（被换掉的那版也存进去，导错了能在设置页回退）
  for (const d of Object.keys(DOC_FILES)) {
    if (!items.has(d as BackupItem)) continue
    for (const [file, history] of DOC_FILES[d]) {
      if (!existsSync(join(pending, file))) continue
      new TextDoc(join(dataDir, file), join(dataDir, history), historyKeep).write(readFileSync(join(pending, file), 'utf-8'), { by: 'import', reason: '导入备份包' })
    }
  }
  const dirs = DIR_ITEMS.filter(d => items.has(d) && DOC_FILES[d] === undefined)
  const aside = join(dataDir, '.replaced-' + Date.now().toString(36))
  mkdirSync(aside, { recursive: true })
  const moved: string[] = []
  try {
    for (const d of dirs) {
      if (existsSync(join(dataDir, d))) { renameSync(join(dataDir, d), join(aside, d)); moved.push(d) }
      if (existsSync(join(pending, d))) renameSync(join(pending, d), join(dataDir, d))
    }
  } catch (e) {
    for (const d of moved) if (!existsSync(join(dataDir, d))) renameSync(join(aside, d), join(dataDir, d))
    throw e
  }
  if (items.has('archiveMaster') && existsSync(join(pending, 'media'))) {
    mkdirSync(join(dataDir, 'media'), { recursive: true })
    for (const name of readdirSync(join(pending, 'media'))) if (!existsSync(join(dataDir, 'media', name))) cpSync(join(pending, 'media', name), join(dataDir, 'media', name))
  }
  rmSync(pending, { recursive: true, force: true })
  rmSync(aside, { recursive: true, force: true })
  return { manifest, plan: { ...plan, items: ITEMS.filter(i => items.has(i)) } }
}

/** 把备份库里勾选的部分换进当前库（两边先各自升级到当前版本，表结构就一样了）。 */
function mergeDb(currentPath: string, backupPath: string, items: Set<BackupItem>): void {
  new Archive(backupPath).close()
  new Archive(currentPath).close()
  const db = new DatabaseSync(currentPath)
  db.exec("ATTACH DATABASE '" + backupPath.replace(/'/g, "''") + "' AS bk")
  const cols = (table: string): string[] => (db.prepare('PRAGMA main.table_info(' + table + ')').all() as Array<{ name: string }>).map(r => r.name)
  const copyAll = (table: string, where = ''): void => {
    const c = cols(table).join(', ')
    db.exec('DELETE FROM main.' + table + (where ? ' WHERE ' + where : ''))
    db.exec('INSERT INTO main.' + table + ' (' + c + ') SELECT ' + c + ' FROM bk.' + table + (where ? ' WHERE ' + where : ''))
  }
  db.exec('BEGIN')
  try {
    if (items.has('memory')) {
      for (const t of MEMORY_TABLES) copyAll(t)
      copyAll('meta', "key LIKE 'embed_dim:%' OR key LIKE 'care:%'")
    }
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  } finally {
    try { db.exec('DETACH DATABASE bk') } catch { /* 关库时也会断开 */ }
    db.close()
  }
}
