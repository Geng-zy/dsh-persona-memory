// 主动聊天：每个 QQ 会话各自按随机间隔唤醒她一次，让她自己决定要不要说话（不想说就回「[不发]」）。
//   - 主人私聊：默认每 1～4 小时一次（在这个范围里均匀随机）；
//   - 其他人的私聊和群聊：默认每 2～4 小时一次，而且只找最近 7 天里聊过的；
//   - 她 30 分钟内在这个会话里说过话就不触发，从她最后一句起再等一个间隔；
//   - 免打扰时间（默认 01:00–09:00）不触发，顺延到之后；
//   - 群聊主动时带上群里最近 15 条消息当上下文（含她自己说的，图片用收到时存好的，不限张数）。
// 需要 dsh-napcat-bridge ≥ 0.7.0 的 ctx.napcat.wake。

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Archive } from './archive.js'
import { localClock } from './diary.js'
import type { Organizer } from './organizer.js'
import type { Category, Scope } from './rules.js'

const MINUTE = 60_000
const DAY = 86_400_000

export interface ProactiveSettings {
  enabled: boolean
  /** 主人私聊的间隔范围（分钟） */
  masterMinMinutes: number
  masterMaxMinutes: number
  /** 其他私聊和群聊的间隔范围（分钟） */
  othersMinMinutes: number
  othersMaxMinutes: number
  privateEnabled: boolean
  groupEnabled: boolean
  /** 免打扰 HH:MM–HH:MM（可以跨午夜） */
  quietStart: string
  quietEnd: string
  /** 她这么多分钟内在这个会话里说过话就不触发 */
  recentMinutes: number
  /** 群聊带几条上下文（里面的图片不限张数） */
  groupContextMessages: number
  /** 其他人：最近几天里聊过才主动找 */
  activeWithinDays: number
  silenceToken: string
  timeZone: string
  /** 例外规则里这个会话是开（true）、关（false）还是用默认（undefined） */
  override(scope: Scope): boolean | undefined
}

export interface ProactiveDeps {
  archive: Archive
  organizer: Organizer
  settings(): ProactiveSettings
  wake(): ((umo: string, content: unknown[]) => Promise<unknown>) | undefined
  meta: { get(key: string): string | undefined; set(key: string, value: string): void }
  mediaDir: string
  log(level: 'debug' | 'info' | 'warn', message: string): void
  random?: () => number
}

/** 现在是不是免打扰时间。 */
export function inQuiet(clock: string, start: string, end: string): boolean {
  if (start === end) return false
  return start < end ? clock >= start && clock < end : clock >= start || clock < end
}

/** 下一次间隔（毫秒）：主人和其他人各自在自己的范围里均匀随机。 */
export function nextDelay(category: Category, s: Pick<ProactiveSettings, 'masterMinMinutes' | 'masterMaxMinutes' | 'othersMinMinutes' | 'othersMaxMinutes'>, random: () => number = Math.random): number {
  const [min, max] = category === 'master' ? [s.masterMinMinutes, s.masterMaxMinutes] : [s.othersMinMinutes, s.othersMaxMinutes]
  const lo = Math.max(1, Math.min(min, max))
  const hi = Math.max(lo, max)
  return Math.round((lo + (hi - lo) * random()) * MINUTE)
}

function gapText(ms: number): string {
  const minutes = Math.round(ms / MINUTE)
  if (minutes < 60) return minutes + ' 分钟'
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return hours + ' 小时' + (minutes % 60 > 0 ? ' ' + (minutes % 60) + ' 分钟' : '')
  return Math.floor(hours / 24) + ' 天'
}

function nowText(now: number, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', { timeZone: timeZone || undefined, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'long', hour12: false }).format(new Date(now))
  } catch {
    return new Date(now).toISOString()
  }
}

/** 唤醒她时说的话。 */
export function proactivePrompt(category: Category, now: number, lastTime: number | undefined, s: Pick<ProactiveSettings, 'silenceToken' | 'timeZone'>, groupLines: readonly string[] = []): string {
  const since = lastTime === undefined ? '你们还没怎么聊过。' : '上一次有人说话是 ' + gapText(now - lastTime) + '前。'
  const who = category === 'master' ? '主人' : category === 'group' ? '群里' : '对方'
  const lines = ['<proactive>', '现在是 ' + nowText(now, s.timeZone) + '。' + since]
  if (category === 'group') {
    lines.push('', '群里最近的消息：', ...(groupLines.length > 0 ? groupLines : ['（最近没什么消息）']), '',
      '你可以看看群里在聊什么：觉得能自然地接上话、或者有想跟大家说的，就说一句；大家在聊的事和你无关、或者没什么想说的，就不说。')
  } else if (category === 'master') {
    lines.push('你可以主动找主人说点什么：关心他、分享你想到的事、接着之前的话题、提醒答应过的事都可以；觉得现在不合适（比如他可能在忙、在睡觉）或者没什么想说的，就不发。')
  } else {
    lines.push('你可以主动找' + who + '说点什么；觉得不合适或者没什么想说的，就不发。')
  }
  lines.push('想说就直接写要发的话，像平时聊天一样，不要提"主动""系统""提示"这些；不想说就只回复「' + s.silenceToken + '」。', '</proactive>')
  return lines.join('\n')
}

export interface ProactiveEntry {
  umo: string
  category: Category
  next?: number
  last?: number
  lastResult?: string
}

export class Proactive {
  private busy = new Set<string>()
  private readonly random: () => number

  constructor(private readonly deps: ProactiveDeps) {
    this.random = deps.random ?? Math.random
  }

  private scopeOf(umo: string, kind: string): Scope {
    const category = this.deps.organizer.categoryOf(umo, kind)
    const id = umo.split(':').pop() ?? ''
    return category === 'group' ? { category, qq: true, umo, groupId: id } : { category, qq: true, umo, userId: id }
  }

  /** 这个会话要不要主动找。 */
  private eligible(scope: Scope, lastTime: number | undefined, now: number): boolean {
    const s = this.deps.settings()
    const o = s.override(scope)
    if (o === false) return false
    if (scope.category === 'master') return true
    if (o !== true && (scope.category === 'group' ? !s.groupEnabled : !s.privateEnabled)) return false
    return lastTime !== undefined && now - lastTime <= s.activeWithinDays * DAY
  }

  private schedule(umo: string, category: Category, from: number): number {
    const next = from + nextDelay(category, this.deps.settings(), this.random)
    this.deps.meta.set('proactive:next:' + umo, String(next))
    return next
  }

  /** 每分钟调一次。返回这次唤醒了哪些会话。 */
  async tick(now = Date.now()): Promise<string[]> {
    const s = this.deps.settings()
    if (!s.enabled) return []
    const woken: string[] = []
    for (const { umo, kind } of this.deps.archive.umos()) {
      if (umo.split(':').pop()?.includes('_')) continue
      const scope = this.scopeOf(umo, kind)
      const last = this.deps.archive.lastTime(umo)
      if (!this.eligible(scope, last, now)) continue
      const stored = Number(this.deps.meta.get('proactive:next:' + umo) ?? NaN)
      if (!Number.isFinite(stored)) { this.schedule(umo, scope.category, now); continue }
      if (now < stored || this.busy.has(umo)) continue
      if (inQuiet(localClock(now, s.timeZone), s.quietStart, s.quietEnd)) {
        // 免打扰：过半小时再看（随机一点，免得一到点所有会话一起来）
        this.deps.meta.set('proactive:next:' + umo, String(now + 30 * MINUTE + Math.round(this.random() * 30 * MINUTE)))
        continue
      }
      const lastOut = this.deps.archive.lastOutTime(umo)
      if (lastOut !== undefined && now - lastOut < s.recentMinutes * MINUTE) {
        // 她刚说过话：从她最后一句起再等一个间隔
        this.schedule(umo, scope.category, lastOut)
        continue
      }
      this.schedule(umo, scope.category, now)
      if (await this.fire(umo, scope, now)) woken.push(umo)
    }
    return woken
  }

  /** 唤醒一次（设置页「试一次」也用它）。 */
  async fire(umo: string, scope: Scope, now = Date.now()): Promise<boolean> {
    const wake = this.deps.wake()
    if (wake === undefined) {
      this.deps.log('warn', '主动聊天需要 dsh-napcat-bridge ≥ 0.7.0（没有 ctx.napcat.wake）')
      return false
    }
    const s = this.deps.settings()
    this.busy.add(umo)
    try {
      const content: unknown[] = []
      let groupLines: string[] = []
      const images: unknown[] = []
      if (scope.category === 'group') {
        const rows = this.deps.archive.recent(umo, Math.max(0, s.groupContextMessages)).filter(r => r.type === 'message')
        let budget = Infinity
        groupLines = rows.map(r => {
          let extra = ''
          if (budget > 0 && r.segments) {
            try {
              for (const c of JSON.parse(r.segments) as Array<{ type?: string; _local?: string }>) {
                if (budget <= 0 || c?.type !== 'Image' || typeof c._local !== 'string' || !/^[0-9a-f]{64}\.[a-z0-9]+$/.test(c._local)) continue
                const path = join(this.deps.mediaDir, c._local)
                if (!existsSync(path)) continue
                const ext = c._local.split('.').pop()
                images.push({ type: 'image', mediaType: ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg', data: readFileSync(path).toString('base64') })
                budget -= 1
                extra += ' [图片，见下面]'
              }
            } catch { /* 消息段坏了就只用文字 */ }
          }
          const who = r.direction === 'out' ? '我' : (r.senderName || r.senderId) + '(' + r.senderId + ')'
          return '[' + who + '] ' + (r.text.trim() || '[图片/语音等]') + extra
        })
      }
      content.push({ type: 'text', text: proactivePrompt(scope.category, now, this.deps.archive.lastTime(umo), s, groupLines) })
      if (images.length > 0) content.push({ type: 'text', text: '（上面群消息里的图片）' }, ...images)
      await wake(umo, content)
      this.deps.meta.set('proactive:last:' + umo, String(now))
      this.deps.log('info', '主动唤醒了 ' + umo + '，让她决定要不要说话')
      return true
    } catch (e) {
      this.deps.log('warn', '主动唤醒 ' + umo + ' 失败：' + (e instanceof Error ? e.message : String(e)))
      return false
    } finally {
      this.busy.delete(umo)
    }
  }

  /** 设置页显示：每个会话下次什么时候、上次什么时候。 */
  list(now = Date.now()): ProactiveEntry[] {
    const out: ProactiveEntry[] = []
    for (const { umo, kind } of this.deps.archive.umos()) {
      const scope = this.scopeOf(umo, kind)
      if (!this.eligible(scope, this.deps.archive.lastTime(umo), now)) continue
      const next = Number(this.deps.meta.get('proactive:next:' + umo) ?? NaN)
      const last = Number(this.deps.meta.get('proactive:last:' + umo) ?? NaN)
      out.push({ umo, category: scope.category, ...(Number.isFinite(next) ? { next } : {}), ...(Number.isFinite(last) ? { last } : {}) })
    }
    return out.sort((a, b) => (a.category === 'master' ? -1 : 0) - (b.category === 'master' ? -1 : 0) || (a.next ?? 0) - (b.next ?? 0))
  }

  /** 找某个会话的类别（设置页「试一次」用）。 */
  scopeForUmo(umo: string): Scope | undefined {
    const row = this.deps.archive.umos().find(u => u.umo === umo)
    return row === undefined ? undefined : this.scopeOf(umo, row.kind)
  }
}
