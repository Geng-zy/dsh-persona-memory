// dsh-companion-core（插件二）常驻部分：
//   - 人格、核心记忆：挂在 dsh 全局的系统提示词组装环节，QQ 和 dsh 的所有会话每一步都现读；
//   - 她自己改人格/核心记忆的工具：只装在主人的会话里；
//   - 消息存档：从插件一（dsh-napcat-bridge ≥ 0.6.0）的事件收消息；
//   - 给预设里的「上下文管理」行（./context）提供每个会话的规则；
//   - 设置页（client.js）和它用的接口 <dsh>/api/companion/…（要先登录 dsh 网页）。

import z from '@deepseek-ai/schemastery'
import type { Context as CordisContext } from '@deepseek-ai/cordis'
import { join } from 'node:path'
import { Archive, type ArchivedMessage } from './archive.js'
import { TextDoc, defaultDataDir } from './docs.js'
import { applyPrompt, type AssemblyLike } from './prompt.js'
import { archiveRule, contextRule, scopeOf, type Category, type ContextMode, type NapcatLike, type RuleDefaults, type RuleRow, type Scope } from './rules.js'
import type { BeforeCompactPayload, CompanionService, ContextPolicy } from './service.js'
import { coreTool, personaTool, type ToolDeps } from './tools.js'

export type { BeforeCompactPayload, CompanionService, ContextPolicy } from './service.js'
export type { RuleRow, Scope } from './rules.js'

export interface Config {
  excludedPresets: string[]
  personaOnly: boolean
  selfEdit: boolean
  historyKeep: number
  coreMaxKB: number
  thresholdPercent: number
  masterMaxRounds: number
  masterDropRounds: number
  masterMode: ContextMode
  privateMaxRounds: number
  privateDropRounds: number
  privateMode: ContextMode
  groupMaxRounds: number
  groupDropRounds: number
  groupMode: ContextMode
  summaryModel: string
  rules: RuleRow[]
  archiveEnabled: boolean
  archiveUnwoken: boolean
  archiveDaysMaster: number
  archiveDaysOthers: number
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

export type LiveConfig = { [K in keyof Config]: { get(): Config[K] } }

const mode = (def: ContextMode) => z.union(['truncate', 'llm']).default(def).volatile()

// 每项都 .volatile()：dsh 的设置服务只在线编辑这种字段，保存后插件直接读到新值
export const Config: z<LiveConfig> = z.object({
  excludedPresets: z.array(z.string()).default([]).volatile().description('不生效的预设 id（例如写代码用的预设）'),
  personaOnly: z.boolean().default(true).volatile().description('只用人格：去掉 dsh 的编程助手身份句'),
  selfEdit: z.boolean().default(true).volatile().description('让她能自己改人格和核心记忆（只在主人的会话里）'),
  historyKeep: z.natural().default(5).volatile().description('人格、核心记忆各保留几份历史版本'),
  coreMaxKB: z.natural().min(1).default(24).volatile().description('核心记忆上限（KB）'),
  thresholdPercent: z.natural().min(10).max(95).default(70).volatile().description('上下文到模型上限的百分之多少就处理'),
  masterMaxRounds: z.natural().default(60).volatile().description('主人：最多保留轮数（0 = 不限）'),
  masterDropRounds: z.natural().min(1).default(20).volatile().description('主人：一次处理几轮'),
  masterMode: mode('llm').description('主人：处理方式'),
  privateMaxRounds: z.natural().default(60).volatile().description('其他私聊：最多保留轮数'),
  privateDropRounds: z.natural().min(1).default(20).volatile().description('其他私聊：一次处理几轮'),
  privateMode: mode('truncate').description('其他私聊：处理方式'),
  groupMaxRounds: z.natural().default(60).volatile().description('群聊：最多保留轮数'),
  groupDropRounds: z.natural().min(1).default(20).volatile().description('群聊：一次处理几轮'),
  groupMode: mode('truncate').description('群聊：处理方式'),
  summaryModel: z.string().default('').volatile().description('LLM 压缩用的模型（提供方/模型）；空 = 用会话自己的'),
  rules: z.array(z.object({
    target: z.string(),
    kind: z.union(['user', 'group']).default('user'),
    maxRounds: z.natural(),
    dropRounds: z.natural(),
    mode: z.union(['', 'truncate', 'llm']).default(''),
    archiveDays: z.natural(),
    archiveUnwoken: z.union(['', 'on', 'off']).default(''),
    note: z.string(),
  })).default([]).volatile().description('例外规则：按 QQ 号或群号单独设置'),
  archiveEnabled: z.boolean().default(true).volatile().description('消息存档'),
  archiveUnwoken: z.boolean().default(true).volatile().description('保存没唤醒她的群消息'),
  archiveDaysMaster: z.natural().min(1).default(365).volatile().description('主人私聊存档保留天数'),
  archiveDaysOthers: z.natural().min(1).default(5).volatile().description('其他私聊和群聊存档保留天数'),
  logLevel: z.union(['debug', 'info', 'warn', 'error']).default('info').volatile().description('日志级别'),
}) as never

export const name = 'dsh-companion-core'
// napcat（插件一）、agents 都是可选的，用到时 ctx.get

type Context = CordisContext & { napcat?: NapcatLike; agents?: { list(): any[] } }

const RANK = { debug: 0, info: 1, warn: 2, error: 3 } as const
const MAX_LOGS = 200
const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e))

export function apply(ctx: Context, live: LiveConfig): void {
  const get = <K extends keyof Config>(key: K): Config[K] => live[key]?.get() as Config[K]
  const logs: Array<{ time: number; level: string; message: string }> = []
  const log = (level: keyof typeof RANK, message: string): void => {
    logs.push({ time: Date.now(), level, message })
    if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS)
    if (RANK[level] < RANK[get('logLevel') ?? 'info']) return
    const line = '[companion] ' + message
    if (level === 'error') console.error(line)
    else if (level === 'warn') console.warn(line)
    else console.log(line)
  }

  const dir = defaultDataDir()
  const keep = (): number => get('historyKeep')
  const persona = new TextDoc(join(dir, 'persona', 'persona.md'), join(dir, 'persona', 'history'), keep)
  const coreMaster = new TextDoc(join(dir, 'core', 'master.md'), join(dir, 'core', 'history-master'), keep)
  const corePublic = new TextDoc(join(dir, 'core', 'public.md'), join(dir, 'core', 'history-public'), keep)
  const docs: Record<string, TextDoc> = { persona, 'core-master': coreMaster, 'core-public': corePublic }
  let archive: Archive | undefined
  try {
    archive = new Archive(join(dir, 'companion.db'))
  } catch (e) {
    log('error', '打不开存档数据库，消息存档暂停：' + errText(e))
  }

  const napcat = (): NapcatLike | undefined => ctx.get('napcat' as never) as NapcatLike | undefined
  const scope = (sessionId: string): Scope => scopeOf(sessionId, napcat())
  const excluded = (presetId: string | undefined): boolean => presetId !== undefined && presetId !== '' && get('excludedPresets').map(s => s.trim()).includes(presetId)
  const defaults = (): RuleDefaults => ({
    context: {
      master: { maxRounds: get('masterMaxRounds'), dropRounds: get('masterDropRounds'), mode: get('masterMode') },
      private: { maxRounds: get('privateMaxRounds'), dropRounds: get('privateDropRounds'), mode: get('privateMode') },
      group: { maxRounds: get('groupMaxRounds'), dropRounds: get('groupDropRounds'), mode: get('groupMode') },
    },
    archive: {
      master: { days: get('archiveDaysMaster'), unwoken: true },
      private: { days: get('archiveDaysOthers'), unwoken: true },
      group: { days: get('archiveDaysOthers'), unwoken: get('archiveUnwoken') },
    },
  })
  const rules = (): RuleRow[] => (get('rules') ?? []).filter(r => r && String(r.target ?? '').trim() !== '')
  const coreFor = (category: Category): string => {
    const pub = corePublic.read().trim()
    if (category !== 'master') return pub
    const own = coreMaster.read().trim()
    return [pub, own].filter(s => s !== '').join('\n\n')
  }

  //#region 给预设里「上下文管理」行的服务
  const service: CompanionService = {
    contextPolicy(sessionId: string, presetId?: string): ContextPolicy | undefined {
      if (excluded(presetId)) return undefined
      const s = scope(sessionId)
      const text = get('summaryModel').trim()
      const slash = text.indexOf('/')
      const summaryModel = slash > 0 && slash < text.length - 1 ? { provider: text.slice(0, slash), model: text.slice(slash + 1) } : undefined
      return { scope: s, rule: contextRule(s, defaults(), rules()), thresholdPercent: get('thresholdPercent'), ...(summaryModel ? { summaryModel } : {}) }
    },
    async beforeCompact(payload: BeforeCompactPayload): Promise<void> {
      await ctx.serial('companion/before-compact', payload)
    },
    log,
  }
  ctx.provide('companion', service)
  //#endregion

  //#region 人格、核心记忆：所有会话每一步现读
  ctx.on('system-prompt/assemble' as never, (async (_assembly: AssemblyLike, context: { agent?: any }, next: () => Promise<AssemblyLike>) => {
    const assembly = await next()
    const agent = context.agent
    if (agent === undefined) return assembly
    try {
      if (excluded(agent.session?.meta?.agentPreset)) return assembly
      const s = scope(String(agent.session.id))
      return applyPrompt(assembly, { persona: persona.read(), core: coreFor(s.category), personaOnly: get('personaOnly') })
    } catch (e) {
      log('warn', '放人格时出错，这一步用 dsh 原来的提示词: ' + errText(e))
      return assembly
    }
  }) as never)
  //#endregion

  //#region 主人会话里装上改人格/核心记忆的工具
  const toolDeps: ToolDeps = {
    persona, coreMaster, corePublic,
    isMaster: sessionId => get('selfEdit') && scope(sessionId).category === 'master',
    coreMaxBytes: () => get('coreMaxKB') * 1024,
    log,
  }
  const equipped = new WeakMap<object, Array<() => void>>()
  const equip = (agent: any): void => {
    if (agent === undefined || equipped.has(agent)) return
    const sessionId = String(agent.session?.id ?? '')
    if (excluded(agent.session?.meta?.agentPreset) || scope(sessionId).category !== 'master') return
    const tools = agent.ctx?.tools
    if (tools === undefined) {
      log('warn', '会话 ' + sessionId + ' 没有工具服务，装不了改人格的工具')
      return
    }
    const disposers: Array<() => void> = []
    for (const def of [personaTool(toolDeps), coreTool(toolDeps)]) {
      try {
        const off = tools.register(def)
        if (typeof off === 'function') disposers.push(off)
      } catch (e) {
        log('warn', '会话 ' + sessionId + ' 装工具 ' + def.name + ' 失败: ' + errText(e))
      }
    }
    equipped.set(agent, disposers)
    log('debug', '会话 ' + sessionId + ' 装上了改人格/核心记忆的工具')
  }
  ctx.on('agent/created' as never, ((payload: { agent: any }) => { equip(payload.agent) }) as never)
  // 插件启动（或重新加载）时，给已经在跑的会话补装
  ctx.effect(() => {
    try {
      for (const agent of (ctx.get('agents' as never) as { list?(): any[] } | undefined)?.list?.() ?? []) equip(agent)
    } catch (e) {
      log('debug', '列出已有会话失败: ' + errText(e))
    }
    return () => {
      for (const agent of (ctx.get('agents' as never) as { list?(): any[] } | undefined)?.list?.() ?? []) {
        for (const off of equipped.get(agent) ?? []) {
          try { off() } catch { /* 会话已经结束 */ }
        }
      }
    }
  }, 'companion: tools')
  //#endregion

  //#region 消息存档（插件一的事件）
  const store = (m: ArchivedMessage): void => {
    if (archive === undefined || !get('archiveEnabled')) return
    try {
      archive.add(m)
    } catch (e) {
      log('warn', '存档失败: ' + errText(e))
    }
  }
  ctx.on('napcat/message' as never, ((abm: any, event: any, isWake: boolean) => {
    const umo = String(event?.unified_msg_origin ?? '')
    if (umo === '') return
    const isGroup = abm?.type === 'GroupMessage'
    const info = (napcat() as any)?.sessionInfoByUmo?.(umo) as { sessionId?: string; adminPrivate?: boolean } | undefined
    const s: Scope = isGroup
      ? { category: 'group', qq: true, groupId: String(abm.raw_message?.group_id ?? abm.group?.group_id ?? abm.session_id ?? '') }
      : { category: info?.adminPrivate ? 'master' : 'private', qq: true, userId: String(abm.session_id ?? abm.sender?.user_id ?? '') }
    if (isGroup && !isWake && !archiveRule(s, defaults(), rules()).unwoken) return
    const notice = abm?.raw_message?.post_type !== 'message'
    let segments: string | undefined
    try { segments = JSON.stringify(abm.message ?? []) } catch { segments = undefined }
    store({
      umo, kind: isGroup ? 'group' : 'private',
      ...(isGroup ? { groupId: s.groupId } : { userId: s.userId }),
      ...(abm.message_id !== undefined && abm.message_id !== '' ? { messageId: String(abm.message_id) } : {}),
      time: typeof abm.timestamp === 'number' ? abm.timestamp * 1000 : Date.now(),
      direction: 'in',
      senderId: String(abm.sender?.user_id ?? ''),
      senderName: String(abm.sender?.nickname ?? ''),
      woke: isWake, type: notice ? 'notice' : 'message',
      text: notice ? String(abm.event_text ?? abm.message_str ?? '') : String(abm.message_str ?? ''),
      ...(segments !== undefined && !notice ? { segments } : {}),
      ...(info?.sessionId ? { sessionId: info.sessionId } : {}),
    })
  }) as never)
  ctx.on('napcat/sent' as never, ((p: { umo: string; session: { message_type: string; session_id: string }; text: string; time: number }) => {
    const isGroup = p.session?.message_type === 'GroupMessage'
    const info = (napcat() as any)?.sessionInfoByUmo?.(p.umo) as { sessionId?: string; selfId?: string } | undefined
    store({
      umo: p.umo, kind: isGroup ? 'group' : 'private',
      ...(isGroup ? { groupId: p.session.session_id } : { userId: p.session.session_id }),
      time: p.time ?? Date.now(), direction: 'out',
      senderId: String(info?.selfId ?? 'self'), senderName: '她',
      woke: true, type: 'message', text: String(p.text ?? ''),
      ...(info?.sessionId ? { sessionId: info.sessionId } : {}),
    })
  }) as never)
  //#endregion

  //#region 设置页用的接口：<dsh>/api/companion/…（挂在 dsh 的 /api 钩子上，要先登录）
  const DOC_NAMES = Object.keys(docs)
  const readBody = (req: import('node:http').IncomingMessage): Promise<any> => new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > 4 * 1024 * 1024) { reject(new Error('内容太大')); req.destroy() } else chunks.push(c)
    })
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')) } catch (e) { reject(e) } })
    req.on('error', reject)
  })
  const state = (): Record<string, unknown> => ({
    dataDir: dir,
    napcat: napcat() !== undefined,
    docs: Object.fromEntries(DOC_NAMES.map(n => [n, { text: docs[n].read(), history: docs[n].history() }])),
    archive: archive?.stats() ?? null,
    logs: logs.slice(-100),
  })
  ctx.on('connection/request' as never, (async (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next: () => Promise<void>) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname
    const at = path.indexOf('/companion/')
    if (at < 0 || !path.slice(0, at).endsWith('/api')) return next()
    const parts = path.slice(at + '/companion/'.length).split('/').filter(Boolean)
    const json = (code: number, value: unknown): void => {
      res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(value))
    }
    try {
      if (req.method === 'GET' && parts[0] === 'state') return json(200, state())
      if (parts[0] === 'doc' && DOC_NAMES.includes(parts[1] ?? '')) {
        const doc = docs[parts[1]]
        if (req.method === 'GET' && parts[2] === 'version' && parts[3]) {
          const text = doc.version(parts[3])
          return text === undefined ? json(404, { error: '没有这个版本' }) : json(200, { text })
        }
        if (req.method !== 'POST') return json(405, { error: '只支持 POST' })
        // 要求 JSON 请求：跨站表单提交带不了这个类型，防止别的网页借你的登录改人格
        if (!String(req.headers['content-type'] ?? '').includes('application/json')) return json(415, { error: '需要 application/json' })
        if (parts[2] === 'restore' && parts[3]) {
          const ok = doc.restore(parts[3])
          if (ok) log('info', '设置页把' + parts[1] + '回退到 ' + parts[3])
          return ok ? json(200, state()) : json(404, { error: '没有这个版本' })
        }
        const body = await readBody(req)
        if (typeof body?.text !== 'string') return json(400, { error: '缺少 text' })
        if (parts[1] !== 'persona' && Buffer.byteLength(body.text) > get('coreMaxKB') * 1024) return json(400, { error: '超过核心记忆上限' })
        doc.write(body.text, { by: 'settings' })
        log('info', '设置页修改了 ' + parts[1])
        return json(200, state())
      }
      return json(404, { error: 'not found' })
    } catch (e) {
      return json(500, { error: errText(e) })
    }
  }) as never)
  //#endregion

  // 自带设置页（client.js），告诉 dsh 不用按 schema 自动生成表单
  ctx.inject(['settings'], child => {
    child.effect(() => (child as any).settings.configure({ auto: false }, ctx.fiber), 'companion: settings policy')
  })

  ctx.effect(() => () => { archive?.close() }, 'companion: archive')
}
