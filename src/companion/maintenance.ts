// 人格插件每日任务：管理员日记和月度总览。QQ存档保留与轮换由QQ插件负责。

import type { Archive } from './archive.js'
import { diaryPrompt, logicalDay, monthPrompt, type DiaryStore } from './diary.js'
import { complete, type LlmLike, type ModelTarget } from './extract.js'
import type { MemoryStore } from './memory.js'
import type { Organizer } from './organizer.js'
import { transcriptOf } from './organizer.js'


export interface MaintenanceSettings {
  diaryEnabled: boolean
  monthlyEnabled: boolean
  boundaryHour: number
  timeZone: string
}

export interface MaintenanceDeps {
  archive: Archive
  store: MemoryStore
  diary: DiaryStore
  organizer: Organizer
  llm(): LlmLike | undefined
  target(): ModelTarget | undefined
  settings(): MaintenanceSettings
  log(level: 'debug' | 'info' | 'warn', message: string): void
}

export interface MaintenanceReport {
  at: number
  diary?: { date: string; written: boolean; month?: string; error?: string }
  expired: Array<{ umo: string; deleted: number; rotated?: string; error?: string }>
  deletedSessions: string[]
  failedSessions: Array<{ sessionId: string; error: string }>
  mediaRemoved: number
}

const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e))

export class Maintenance {
  private running: Promise<MaintenanceReport> | undefined
  last: MaintenanceReport | undefined

  constructor(private readonly deps: MaintenanceDeps) {}

  /** 跑一遍（同时只跑一个）。 */
  run(now = Date.now()): Promise<MaintenanceReport> {
    if (this.running !== undefined) return this.running
    this.running = this.doRun(now).finally(() => { this.running = undefined })
    return this.running
  }

  private async doRun(now: number): Promise<MaintenanceReport> {
    const report: MaintenanceReport = { at: now, expired: [], deletedSessions: [], failedSessions: [], mediaRemoved: 0 }
    if (this.deps.settings().diaryEnabled) {
      try {
        report.diary = await this.writeDiary(now)
      } catch (e) {
        report.diary = { date: logicalDay(now, this.deps.settings().boundaryHour, this.deps.settings().timeZone), written: false, error: errText(e) }
        this.deps.log('warn', '写日记失败：' + errText(e))
      }
    }
    this.last = report
    return report
  }

  /** 主人的 QQ 会话（存档里记着类别是主人的）。 */
  private masterUmos(): string[] {
    return this.deps.archive.umos().filter(u => this.deps.organizer.categoryOf(u.umo, u.kind) === 'master').map(u => u.umo)
  }

  //#region 日记
  async writeDiary(now: number): Promise<NonNullable<MaintenanceReport['diary']>> {
    const s = this.deps.settings()
    const { archive, diary, store } = this.deps
    const date = logicalDay(now, s.boundaryHour, s.timeZone)
    const from = archive.cursor('diary:to') || now - 36 * 3_600_000
    const rows = archive.between(this.masterUmos(), from, now)
    const journal = archive.journalBetween(from, now)
    const lines = [
      ...transcriptOf(rows).map((text, i) => ({ time: rows[i].time, text })),
      ...journal.map(j => ({ time: j.time, text: '[dsh] ' + (j.role === 'master' ? '主人' : '我') + '：' + j.text })),
    ].sort((a, b) => a.time - b.time).map(x => x.text)
    const memories = store.createdBetween('master', from, now).map(m => m.content)
    let month: string | undefined
    if (lines.length === 0 && memories.length === 0) {
      archive.setCursor('diary:to', now)
      this.deps.log('info', date + ' 没有和主人的聊天，不写日记')
    } else {
      const llm = this.deps.llm()
      const target = this.deps.target()
      if (llm === undefined || target === undefined) throw new Error('没有可用的模型')
      const recent = diary.recentDays(3, date)
      let text = (await complete(llm, target, diaryPrompt(date, lines.slice(-600), memories, recent), 4096)).trim()
      if (text === '') throw new Error('模型没写出日记')
      const existing = diary.readDay(date)
      if (existing !== undefined && existing.trim() !== '') text = existing.trim() + '\n\n（后来又写了一段）\n\n' + text.replace(/^#.*\n+/, '')
      diary.writeDay(date, text)
      store.add({ scope: 'master', kind: 'diary', content: text, importance: 0.8, trust: 1, writer: 'diary', sourceFrom: from, sourceTo: now })
      archive.setCursor('diary:to', now)
      this.deps.log('info', '写好了 ' + date + ' 的日记（' + text.length + ' 字）')
    }
    // 跨月了：给上个月写总览
    if (s.monthlyEnabled) {
      const thisMonth = date.slice(0, 7)
      const done = diary.months()
      const pendingMonth = diary.days().map(d => d.slice(0, 7)).filter(m => m < thisMonth && !done.includes(m)).sort().pop()
      if (pendingMonth !== undefined) {
        const days = diary.days().filter(d => d.startsWith(pendingMonth)).sort().map(d => ({ date: d, text: diary.readDay(d) ?? '' }))
        const llm = this.deps.llm()
        const target = this.deps.target()
        if (llm !== undefined && target !== undefined && days.length > 0) {
          const text = (await complete(llm, target, monthPrompt(pendingMonth, days), 4096)).trim()
          if (text !== '') {
            diary.writeMonth(pendingMonth, text)
            store.add({ scope: 'master', kind: 'diary', content: text, importance: 0.9, trust: 1, writer: 'diary' })
            month = pendingMonth
            this.deps.log('info', '写好了 ' + pendingMonth + ' 的月度总览')
          }
        }
      }
    }
    return { date, written: lines.length > 0 || memories.length > 0, ...(month ? { month } : {}) }
  }
  //#endregion

}
