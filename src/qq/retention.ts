import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import type { Archive } from './archive.js'
import type { Category, Scope } from './rules.js'
const DAY=86_400_000
const errText=(e:unknown)=>e instanceof Error?e.message:String(e)
function scopeOfUmo(umo:string,category:Category):Scope {const id=umo.split(':').pop()??'';return category==='group'?{category,qq:true,umo,groupId:id}:{category,qq:true,umo,userId:id}}
function transcriptOf(rows: ReturnType<Archive['recent']>):string[]{return rows.map(r=>'['+(r.direction==='out'?'我':r.senderName||r.senderId)+'] '+r.text)}
interface MaintenanceReport {at:number;expired:Array<{umo:string;deleted:number;rotated?:string;error?:string}>;deletedSessions:string[];failedSessions:Array<{sessionId:string;error:string}>;mediaRemoved:number}
interface Deps {
 archive: Archive
 organizer: {categoryOf(umo:string,kind:string):Category;organizeUmo(umo:string,reason:string):Promise<unknown>}
 settings():{rotateSessions:boolean;deleteOldSessions:boolean;carryMessages:number;archiveDays(s:Scope):number}
 snowluma():{rotateSession?(umo:string):Promise<{oldSessionId:string;newSessionId:string}>}|undefined
 registry():{archiveSession?(id:string,options?:{stopActivity?:boolean}):Promise<void>;unarchiveSession?(id:string):Promise<void>;list?():Array<{sessionIds:readonly string[];detachSession?(id:string):Promise<void>}>}|undefined
 persistence():{stat(id:string):Promise<unknown>;list?():Promise<unknown[]>}|undefined
 isLive(id:string):boolean
 isRunning(id:string):boolean
 sessionsRoot:string
 mediaDir:string
 setCarry(umo:string,text:string):void
 log(level:'debug'|'info'|'warn',message:string):void
}
export class QqRetention {
 private running?: Promise<MaintenanceReport>
 last?: MaintenanceReport
 constructor(private readonly deps:Deps){}
 run(now=Date.now()):Promise<MaintenanceReport>{if(this.running)return this.running;this.running=this.doRun(now).finally(()=>{this.running=undefined});return this.running}
 private async doRun(now:number):Promise<MaintenanceReport>{const report:MaintenanceReport={at:now,expired:[],deletedSessions:[],failedSessions:[],mediaRemoved:0};await this.expire(now,report);this.last=report;return report}
  //#region 存档到期、换会话
  private async expire(now: number, report: MaintenanceReport): Promise<void> {
    const s = this.deps.settings()
    const { archive, organizer } = this.deps
    for (const { umo, kind } of archive.umos()) {
      const category = organizer.categoryOf(umo, kind)
      const scope = scopeOfUmo(umo, category)
      const cutoff = now - Math.max(1, s.archiveDays(scope)) * DAY
      const item: MaintenanceReport['expired'][number] = { umo, deleted: 0 }
      try {
        const oldest = archive.oldest(umo)
        const current = archive.currentSession(umo)
        // 已经换掉的旧会话（新会话还没有消息时，存档里最近的还是它）不再换第二次
        const needRotate = s.rotateSessions && current !== undefined && current.firstTime < cutoff && !archive.isRetired(current.sessionId)
        if (needRotate && current && this.deps.isRunning(current.sessionId)) continue
        if ((oldest !== undefined && oldest < cutoff) || needRotate) {
          // 先整理还没整理的部分（只整理没整理过的）
          await organizer.organizeUmo(umo, '存档到期')
        }
        if (needRotate && current !== undefined) {
          const rotate = this.deps.snowluma()?.rotateSession
          if (rotate !== undefined) {
            const recent = archive.recent(umo, Math.max(0, s.carryMessages))
            if (recent.length > 0) this.deps.setCarry(umo, transcriptOf(recent).join('\n'))
            const r = await rotate(umo)
            item.rotated = r.newSessionId
            archive.retire({ sessionId: r.oldSessionId, umo, category, lastTime: current.lastTime, state: 'archived' })
            await this.archiveSession(r.oldSessionId)
            this.deps.log('info', umo + ' 用满保留期，换到新会话 ' + r.newSessionId + '，旧会话 ' + r.oldSessionId + ' 已归档')
          }
        }
        if (oldest !== undefined && oldest < cutoff) {
          item.deleted = archive.deleteBefore(umo, cutoff)
          if (item.deleted > 0) this.deps.log('info', umo + ' 删掉了 ' + item.deleted + ' 条到期存档')
        }
      } catch (e) {
        item.error = errText(e)
        this.deps.log('warn', umo + ' 到期处理失败：' + item.error)
      }
      if (item.deleted > 0 || item.rotated || item.error) report.expired.push(item)
    }
    // 其他人的旧会话：最后一条消息也过期了就删掉（主人的永不删）
    if (s.deleteOldSessions) {
      for (const r of archive.retiredList()) {
        if (r.state !== 'archived' || r.category === 'master') continue
        const cutoff = now - Math.max(1, s.archiveDays(scopeOfUmo(r.umo, r.category as Category))) * DAY
        if (r.lastTime >= cutoff) continue
        try {
          await this.deleteSession(r.sessionId)
          archive.retire({ ...r, state: 'deleted' })
          report.deletedSessions.push(r.sessionId)
          this.deps.log('info', '删掉了已归档的旧会话 ' + r.sessionId)
        } catch (e) {
          archive.retire({ ...r, state: 'failed', note: errText(e) })
          report.failedSessions.push({ sessionId: r.sessionId, error: errText(e) })
          this.deps.log('warn', '删旧会话 ' + r.sessionId + ' 失败（保留归档）：' + errText(e))
        }
      }
    }
    // 没被引用的图片、7 天前的聊天流水（已经整理过、写过日记）
    report.mediaRemoved = this.gcMedia()

  }

  private async archiveSession(id: string): Promise<void> {
    try {
      await this.deps.registry()?.archiveSession?.(id, { stopActivity: true })
    } catch (e) {
      this.deps.log('debug', '归档会话 ' + id + ' 时 dsh 说：' + errText(e))
    }
  }

  /**
   * 删一个已归档的旧会话（dsh 没有删除接口，这是我们自己的做法，端到端测试验证过）：
   * 确认不在跑 → 从工作区移除 → 删掉会话文件夹 → 从归档列表去掉 → 确认 dsh 查不到它了、列表还正常。
   * 只删插件一建的 QQ 会话（id 以 snowluma- 开头），文件夹必须在 <DSH_HOME>/sessions 里。
   */
  async deleteSession(id: string): Promise<void> {
    if (!/^snowluma-[A-Za-z0-9-]+$/.test(id)) throw new Error('只删 dsh-snowluma-bridge 建的会话')
    if (this.deps.isLive(id)) throw new Error('会话还在跑')
    const registry = this.deps.registry()
    for (const ws of registry?.list?.() ?? []) {
      if (ws.sessionIds.includes(id)) await ws.detachSession?.(id)
    }
    const root = resolve(this.deps.sessionsRoot)
    const dirs: string[] = []
    if (existsSync(root)) {
      for (const project of readdirSync(root)) {
        const candidate = resolve(root, project, id)
        if (candidate.startsWith(root + sep) && existsSync(candidate) && statSync(candidate).isDirectory()) dirs.push(candidate)
      }
    }
    if (dirs.length === 0) throw new Error('没找到会话文件夹')
    for (const d of dirs) rmSync(d, { recursive: true, force: true })
    try { await registry?.unarchiveSession?.(id) } catch { /* 已经不在归档里 */ }
    const persistence = this.deps.persistence()
    if (persistence !== undefined) {
      if (await persistence.stat(id) !== undefined) throw new Error('删了文件夹，dsh 还能查到这个会话')
      await persistence.list?.()
    }
  }

  /** 删掉没被存档引用的图片，返回删了几个。 */
  private gcMedia(): number {
    const dir = this.deps.mediaDir
    if (!existsSync(dir)) return 0
    const refs = this.deps.archive.mediaRefs()
    let n = 0
    for (const name of readdirSync(dir)) {
      if (refs.has(name)) continue
      rmSync(join(dir, name), { force: true })
      n += 1
    }
    return n
  }
  //#endregion
}
