// 会话分类和"例外规则"：每个会话属于 主人 / 其他私聊 / 群聊 之一，
// 默认规则按类别给，例外规则按 QQ 号或群号覆盖（不按 dsh 会话 id，因为换会话 id 就变）。

/** 插件一（dsh-napcat-bridge ≥ 0.6.0）给的会话信息；这里只声明用到的字段，不依赖插件一的代码。 */
export interface NapcatSessionInfo {
  umo: string
  sessionId: string
  type: 'private' | 'group'
  userId?: string
  groupId?: string
  adminPrivate: boolean
}

export interface ArchiveSession { platform_name: string; message_type: string; session_id: string }

/** 本插件新增：缺少新版 bridge 权限接口时停止 QQ 存档，不能回退为默认放行。 */
export function archiveAllowed(napcat: NapcatLike | undefined, session: ArchiveSession | undefined): boolean {
  if (!session || !session.session_id || typeof napcat?.canArchive !== 'function') return false
  try { return napcat.canArchive(session) === true } catch { return false }
}

export interface NapcatLike {
  canArchive?(session: ArchiveSession): boolean
  sessionInfo?(sessionId: string): NapcatSessionInfo | undefined
}

export type Category = 'master' | 'private' | 'group'

export interface Scope {
  category: Category
  /** 是不是 QQ 会话（插件一建的）；dsh 里直接开的会话为 false */
  qq: boolean
  /** 私聊对方 / 群里每人单独会话时的这个人 */
  userId?: string
  groupId?: string
  /** unified_msg_origin（QQ 会话才有） */
  umo?: string
}

/**
 * 判断一个 dsh 会话属于谁。
 * - 插件一登记过的 QQ 会话：主人私聊 → master，其他私聊 → private，群 → group。
 * - 插件一没登记、但 id 像 QQ 会话（napcat- 开头，比如在 dsh 网页里打开了一个 QQ 会话）：
 *   按 id 里的消息类型归到 group / private，**不当成主人**（里面是别人说的话）。
 * - 其他：dsh 里直接开的会话，只有主人能打开 dsh，算 master。
 */
export function scopeOf(sessionId: string, napcat?: NapcatLike): Scope {
  const info = napcat?.sessionInfo?.(sessionId)
  if (info !== undefined) {
    const category: Category = info.type === 'group' ? 'group' : info.adminPrivate ? 'master' : 'private'
    return { category, qq: true, umo: info.umo, ...(info.userId ? { userId: info.userId } : {}), ...(info.groupId ? { groupId: info.groupId } : {}) }
  }
  if (sessionId.startsWith('napcat-')) {
    if (/-GroupMessage-/.test(sessionId)) return { category: 'group', qq: true }
    return { category: 'private', qq: true }
  }
  return { category: 'master', qq: false }
}

export type ContextMode = 'truncate' | 'llm'

export interface ContextRule {
  /** 最多保留多少轮；0 = 不按轮数限制 */
  maxRounds: number
  /** 超过以后一次处理几轮 */
  dropRounds: number
  mode: ContextMode
}

export interface ArchiveRule {
  /** 保留多少天（阶段 3 起按它删除） */
  days: number
  /** 保存没唤醒她的群消息 */
  unwoken: boolean
}

/** 例外规则的一行（设置页的表格）。空着的项用默认值。 */
export interface RuleRow {
  /** QQ 号或群号 */
  target: string
  kind: 'user' | 'group'
  maxRounds?: number
  dropRounds?: number
  mode?: ContextMode | ''
  archiveDays?: number
  archiveUnwoken?: 'on' | 'off' | ''
  /** 遗忘方式：normal 普通遗忘（可恢复）、purge 直接彻底遗忘 */
  forgetMode?: 'normal' | 'purge' | ''
  /** 主动聊天：on 开、off 关、空用默认 */
  proactive?: 'on' | 'off' | ''
  note?: string
}

export type ForgetMode = 'normal' | 'purge'

export interface RuleDefaults {
  context: Record<Category, ContextRule>
  archive: Record<Category, ArchiveRule>
  forget: Record<Category, ForgetMode>
}

/** 这个会话命中的例外规则：群会话按群号，私聊（含主人）按对方 QQ 号。 */
export function matchRule(scope: Scope, rows: readonly RuleRow[]): RuleRow | undefined {
  const target = (r: RuleRow): string => String(r.target ?? '').trim()
  if (scope.category === 'group' && scope.groupId) return rows.find(r => r.kind === 'group' && target(r) === scope.groupId)
  if (scope.userId) return rows.find(r => r.kind === 'user' && target(r) === scope.userId)
  return undefined
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0

export function contextRule(scope: Scope, defaults: RuleDefaults, rows: readonly RuleRow[]): ContextRule {
  const base = defaults.context[scope.category]
  const row = matchRule(scope, rows)
  if (row === undefined) return { ...base }
  return {
    maxRounds: isCount(row.maxRounds) ? row.maxRounds : base.maxRounds,
    dropRounds: isCount(row.dropRounds) && row.dropRounds > 0 ? row.dropRounds : base.dropRounds,
    mode: row.mode === 'truncate' || row.mode === 'llm' ? row.mode : base.mode,
  }
}

export function archiveRule(scope: Scope, defaults: RuleDefaults, rows: readonly RuleRow[]): ArchiveRule {
  const base = defaults.archive[scope.category]
  const row = matchRule(scope, rows)
  if (row === undefined) return { ...base }
  return {
    days: isCount(row.archiveDays) && row.archiveDays > 0 ? row.archiveDays : base.days,
    unwoken: row.archiveUnwoken === 'on' ? true : row.archiveUnwoken === 'off' ? false : base.unwoken,
  }
}

/** 这个会话的遗忘方式：默认主人普通遗忘、其他直接彻底遗忘，例外规则可改。 */
export function forgetMode(scope: Scope, defaults: RuleDefaults, rows: readonly RuleRow[]): ForgetMode {
  const row = matchRule(scope, rows)
  if (row?.forgetMode === 'normal' || row?.forgetMode === 'purge') return row.forgetMode
  return defaults.forget[scope.category]
}
