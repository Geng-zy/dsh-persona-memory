// dsh-companion-core（插件二）常驻部分：
//   - 人格、核心记忆：挂在 dsh 全局的系统提示词组装环节，QQ 和 dsh 的所有会话每一步都现读；
//   - 她自己改人格/核心记忆的工具：只装在主人的会话里；
//   - 消息存档：从插件一（dsh-napcat-bridge ≥ 0.6.0）的事件收消息；
//   - 给预设里的「上下文管理」行（./context）提供每个会话的规则；
//   - 长期记忆：整理（每 N 轮、压缩前、手动）、召回（每轮放进这一轮的消息里）、主动记忆工具、遗忘、向量索引；
//   - 群聊之前 n 条：通过插件一的 napcat/prompt 把她没看到的群消息一起给她；
//   - 日记和月度总览、主人开新会话时先读日记、存档到期（整理 → 删存档 → 换会话 → 归档/删旧会话）、群消息图片收到时下载；
//   - 设置页（client.js）和它用的接口 <dsh>/api/companion/…（要先登录 dsh 网页）。

import z from '@deepseek-ai/schemastery'
import type { Context as CordisContext } from '@deepseek-ai/cordis'
import { join } from 'node:path'
import { Archive, type ArchivedMessage } from './archive.js'
import { TextDoc, defaultDataDir, writeAtomic } from './docs.js'
import { applyPrompt, type AssemblyLike } from './prompt.js'
import { archiveRule, contextRule, forgetMode, scopeOf, type Category, type ContextMode, type ForgetMode, type NapcatLike, type RuleDefaults, type RuleRow, type Scope } from './rules.js'
import type { BeforeCompactPayload, CompanionService, ContextPolicy } from './service.js'
import { coreTool, personaTool, type ToolDeps } from './tools.js'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { embed, embedEnabled, Indexer, type EmbedSettings } from './embed.js'
import { cleanupPrompt, complete, parseCleanup, type LlmLike, type ModelTarget } from './extract.js'
import { KINDS, MemoryStore, defaultTrust, ownScope, type MemoryKind } from './memory.js'
import { forgetTool, saveTool, searchTool, type MemoryToolDeps } from './memory-tools.js'
import { Organizer } from './organizer.js'
import { formatRecall, recall, type RecallSettings } from './recall.js'
import { countRounds, isHumanTurn, pendingHumanTurn } from './rounds.js'
import { DiaryStore, diaryBlock, guessDate, localClock, logicalDay } from './diary.js'
import { Maintenance } from './maintenance.js'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    /** 本插件放进这一轮的召回记忆 */
    'plugin:companion-memory': { kind: 'plugin:companion-memory' }
  }
}

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
  recallEnabled: boolean
  recallTopK: number
  keywordThreshold: number
  vectorThreshold: number
  keywordWeight: number
  importanceWeight: number
  recencyWeight: number
  groupDiscount: number
  halfLifeDays: number
  activeMemory: boolean
  organizeEveryRounds: number
  organizeBeforeCompact: boolean
  memoryModel: string
  masterForget: ForgetMode
  privateForget: ForgetMode
  groupForget: ForgetMode
  cleanupEnabled: boolean
  cleanupAutoPurge: boolean
  embedApiUrl: string
  embedApiKey: string
  embedModel: string
  embedBatch: number
  groupContextCount: number
  groupContextImages: number
  diaryEnabled: boolean
  diaryTime: string
  dayBoundaryHour: number
  timezone: string
  monthlyEnabled: boolean
  diaryOnNewSession: boolean
  diaryDays: number
  overviewMonths: number
  diaryBudgetPercent: number
  rotateSessions: boolean
  deleteOldSessions: boolean
  carryMessages: number
  archiveImages: boolean
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
    forgetMode: z.union(['', 'normal', 'purge']).default(''),
    note: z.string(),
  })).default([]).volatile().description('例外规则：按 QQ 号或群号单独设置'),
  archiveEnabled: z.boolean().default(true).volatile().description('消息存档'),
  archiveUnwoken: z.boolean().default(true).volatile().description('保存没唤醒她的群消息'),
  archiveDaysMaster: z.natural().min(1).default(365).volatile().description('主人私聊存档保留天数'),
  archiveDaysOthers: z.natural().min(1).default(5).volatile().description('其他私聊和群聊存档保留天数'),
  // 记忆召回
  recallEnabled: z.boolean().default(true).volatile().description('每轮自动想起相关的记忆'),
  recallTopK: z.natural().default(6).volatile().description('每轮最多想起几条'),
  keywordThreshold: z.number().min(0).max(1).default(0.3).volatile().description('只用关键词时的相关度门槛'),
  vectorThreshold: z.number().min(0).max(1).default(0.45).volatile().description('用向量时的相似度门槛'),
  keywordWeight: z.number().min(0).max(1).default(0.3).volatile().description('用向量时关键词占的比重'),
  importanceWeight: z.number().min(0).max(1).default(0.2).volatile().description('排名时重要程度的权重'),
  recencyWeight: z.number().min(0).max(1).default(0.1).volatile().description('排名时新近程度的权重'),
  groupDiscount: z.number().min(0).max(1).default(0.7).volatile().description('主人会话里群记忆的折扣'),
  halfLifeDays: z.natural().min(1).default(30).volatile().description('重要程度的半衰期（天）'),
  // 记忆生成
  activeMemory: z.boolean().default(true).volatile().description('主动记忆：给她回忆、记住、遗忘三个工具'),
  organizeEveryRounds: z.natural().default(20).volatile().description('每多少轮整理一次（0 = 不按轮数）'),
  organizeBeforeCompact: z.boolean().default(true).volatile().description('截断/压缩前先整理'),
  memoryModel: z.string().default('').volatile().description('整理记忆用的模型（提供方/模型）；空 = dsh 默认模型'),
  // 遗忘
  masterForget: z.union(['normal', 'purge']).default('normal').volatile().description('主人的记忆怎么遗忘'),
  privateForget: z.union(['normal', 'purge']).default('purge').volatile().description('别人私聊的记忆怎么遗忘'),
  groupForget: z.union(['normal', 'purge']).default('purge').volatile().description('群聊的记忆怎么遗忘'),
  cleanupEnabled: z.boolean().default(false).volatile().description('主人记忆的模型清理'),
  cleanupAutoPurge: z.boolean().default(false).volatile().description('模型清理判断完直接彻底删除'),
  // 向量检索
  embedApiUrl: z.string().default('https://api.siliconflow.cn/v1').volatile().description('向量接口地址（OpenAI 兼容，到 /v1）'),
  embedApiKey: z.string().role('secret').volatile().description('向量接口 Key；不填不启用向量检索'),
  embedModel: z.string().default('BAAI/bge-m3').volatile().description('向量模型'),
  embedBatch: z.natural().min(1).max(64).default(16).volatile().description('一次算几条'),
  // 群聊上下文
  groupContextCount: z.natural().default(10).volatile().description('参与群话题时附上之前几条她没看到的群消息（0 = 不附）'),
  groupContextImages: z.natural().default(4).volatile().description('附带的群消息里最多给几张图片'),
  // 日记
  diaryEnabled: z.boolean().default(true).volatile().description('每天写日记'),
  diaryTime: z.string().default('01:30').volatile().description('每天几点写日记、处理存档到期（HH:MM）'),
  dayBoundaryHour: z.natural().max(12).default(4).volatile().description('一天按凌晨几点分界'),
  timezone: z.string().default('Asia/Shanghai').volatile().description('时区'),
  monthlyEnabled: z.boolean().default(true).volatile().description('每月写月度总览'),
  diaryOnNewSession: z.boolean().default(true).volatile().description('主人开新会话时先给她看日记'),
  diaryDays: z.natural().default(30).volatile().description('开新会话时给她看最近几天的日记'),
  overviewMonths: z.natural().default(12).volatile().description('开新会话时给她看最近几个月的总览'),
  diaryBudgetPercent: z.natural().min(1).max(60).default(20).volatile().description('这部分最多占模型上限的百分之多少'),
  // 存档到期
  rotateSessions: z.boolean().default(true).volatile().description('会话用满存档保留期就换新会话'),
  deleteOldSessions: z.boolean().default(true).volatile().description('其他人的旧会话过期后删除（主人的永不删）'),
  carryMessages: z.natural().default(10).volatile().description('换会话时带过去最近几条消息'),
  archiveImages: z.boolean().default(true).volatile().description('收到图片时下载存起来（QQ 图片链接会过期）'),
  logLevel: z.union(['debug', 'info', 'warn', 'error']).default('info').volatile().description('日志级别'),
}) as never

export const name = 'dsh-companion-core'
// napcat（插件一）、agents 都是可选的，用到时 ctx.get

type Context = CordisContext & { napcat?: NapcatLike; agents?: { list(): any[] } }

const RANK = { debug: 0, info: 1, warn: 2, error: 3 } as const
const MAX_LOGS = 200
const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e))

export function apply(ctx: Context, live: LiveConfig): void {
  // 密钥字段不设默认值（设置页才能分清"没设置"和"设成空"），读不到时当空字符串
  const get = <K extends keyof Config>(key: K): Config[K] => (live[key]?.get() ?? (key === 'embedApiKey' ? '' : undefined)) as Config[K]
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
    forget: { master: get('masterForget'), private: get('privateForget'), group: get('groupForget') },
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


  //#region 长期记忆：存储、向量索引、整理、召回
  const memories = archive !== undefined ? new MemoryStore(archive.db) : undefined
  const meta = {
    get: (key: string): string | undefined => (archive?.db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined)?.value,
    set: (key: string, value: string): void => { archive?.db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value) },
  }
  const embedSettings = (): EmbedSettings => ({ apiUrl: get('embedApiUrl'), apiKey: get('embedApiKey'), model: get('embedModel'), batch: get('embedBatch') })
  const indexer = memories !== undefined ? new Indexer(memories, embedSettings, meta, log) : undefined
  const llm = (): LlmLike | undefined => ctx.get('llm' as never) as LlmLike | undefined
  const parseTarget = (text: string): ModelTarget | undefined => {
    const t = text.trim()
    const slash = t.indexOf('/')
    return slash > 0 && slash < t.length - 1 ? { provider: t.slice(0, slash), model: t.slice(slash + 1) } : undefined
  }
  const modelTarget = (): ModelTarget | undefined => {
    const configured = parseTarget(get('memoryModel'))
    if (configured !== undefined) return configured
    const sel = (ctx.get('agentDefaultModel' as never) as { currentSelection?(): { provider: string; model: string } | undefined } | undefined)?.currentSelection?.()
    return sel ? { provider: sel.provider, model: sel.model } : undefined
  }
  const afterWrite = (): void => { indexer?.ensure() }
  const organizer = archive !== undefined && memories !== undefined
    ? new Organizer({ archive, store: memories, llm, target: modelTarget, log, afterWrite })
    : undefined
  const diary = new DiaryStore(join(dir, 'diary'))
  const mediaDir = join(dir, 'media')
  const carryKey = (umo: string): string => 'carry:' + umo
  const setCarry = (umo: string, text: string): void => meta.set(carryKey(umo), text)
  const takeCarry = (umo: string): string => {
    const text = meta.get(carryKey(umo)) ?? ''
    if (text !== '') archive?.db.prepare('DELETE FROM meta WHERE key = ?').run(carryKey(umo))
    return text
  }
  const agentsService = (): { get?(id: string): unknown; list?(): any[] } | undefined => ctx.get('agents' as never) as never
  const maintenance = archive !== undefined && memories !== undefined && organizer !== undefined
    ? new Maintenance({
      archive, store: memories, diary, organizer, llm, target: modelTarget,
      settings: () => ({
        diaryEnabled: get('diaryEnabled'), monthlyEnabled: get('monthlyEnabled'), boundaryHour: get('dayBoundaryHour'), timeZone: get('timezone'),
        rotateSessions: get('rotateSessions'), deleteOldSessions: get('deleteOldSessions'), carryMessages: get('carryMessages'),
        archiveDays: s => archiveRule(s, defaults(), rules()).days,
      }),
      napcat: () => napcat() as never,
      registry: () => ctx.get('workspaceRegistry' as never) as never,
      persistence: () => ctx.get('sessionPersistence' as never) as never,
      isLive: id => (agentsService()?.list?.() ?? []).some(a => String(a?.session?.id) === id),
      sessionsRoot: join(dirname(dir), 'sessions'),
      mediaDir,
      setCarry,
      log,
    })
    : undefined
  // 每分钟看一眼：到了写日记的时间、今天还没跑过就跑（日记 + 存档到期）
  ctx.effect(() => {
    const tick = (): void => {
      if (maintenance === undefined || archive === undefined) return
      const now = Date.now()
      const day = logicalDay(now, get('dayBoundaryHour'), get('timezone'))
      if (meta.get('maint:day') === day) return
      const clock = localClock(now, get('timezone'))
      const want = /^\d{1,2}:\d{2}$/.test(get('diaryTime').trim()) ? get('diaryTime').trim().padStart(5, '0') : '01:30'
      // 写日记的时间在分界之前（比如 1:30 < 4:00）：凌晨那段才算；否则当天到点以后都算
      const boundary = String(get('dayBoundaryHour')).padStart(2, '0') + ':00'
      const due = want < boundary ? clock >= want && clock < boundary : clock >= want || clock < boundary
      if (!due) return
      meta.set('maint:day', day)
      void maintenance.run(now).catch(e => log('warn', '每日任务失败：' + errText(e)))
    }
    const timer = setInterval(tick, 60_000)
    return () => clearInterval(timer)
  }, 'companion: daily')

  const recallSettings = (): RecallSettings => ({
    topK: get('recallTopK'), keywordThreshold: get('keywordThreshold'), vectorThreshold: get('vectorThreshold'),
    keywordWeight: get('keywordWeight'), importanceWeight: get('importanceWeight'), recencyWeight: get('recencyWeight'),
    groupDiscount: get('groupDiscount'), halfLifeDays: get('halfLifeDays'),
  })
  /** 问题的向量（启用了向量检索时）；失败就只用关键词。 */
  const queryVector = async (query: string): Promise<{ query: Float32Array; model: string } | undefined> => {
    const es = embedSettings()
    if (!embedEnabled(es)) return undefined
    try {
      const [v] = await embed([query], es)
      return { query: v, model: es.model.trim() }
    } catch (e) {
      log('debug', '召回时算向量失败，只用关键词：' + errText(e))
      return undefined
    }
  }
  const search = async (s: Scope, query: string, topK: number) => {
    if (memories === undefined) return []
    const found = recall(memories, s, query, { ...recallSettings(), topK }, await queryVector(query))
    memories.markRecalled(found.map(f => f.memory.id))
    return found
  }
  const forgetModeOf = (s: Scope): ForgetMode => forgetMode(s, defaults(), rules())
  // 设置页改了向量设置（换模型、填 Key）后自动补算；定时看一眼
  ctx.effect(() => {
    indexer?.ensure()
    const timer = setInterval(() => indexer?.ensure(), 15_000)
    return () => clearInterval(timer)
  }, 'companion: index')

  /** 这个会话的模型上下文窗口（token）；拿不到时按 128K 算。 */
  const contextWindow = async (agent: any): Promise<number> => {
    try {
      const header = agent.session.requestHeader?.()?.config
      const provider = header?.provider || agent.options?.provider
      const model = header?.model || agent.options?.model
      const info = provider && model ? await (llm() as any)?.resolveModelInfo?.(provider, model) : undefined
      const w = info?.context?.contextWindow
      return typeof w === 'number' && w > 0 ? w : 128_000
    } catch {
      return 128_000
    }
  }

  /** 去掉插件一附加的提示，只留人说的话（召回用）。 */
  const queryText = (text: string): string => text.replace(/<system_reminder>[\s\S]*?<\/system_reminder>/g, ' ').replace(/<(Quoted|Forward) Message>[\s\S]*?<\/\1 Message>/g, ' ').trim()

  // 召回：每一轮的第一步，把想起来的记忆作为这一轮的一条消息放进去（不放系统提示词，前面的缓存不受影响）。
  // QQ 会话和 dsh 里的会话都走这里。
  ctx.on('agent/pre-step' as never, (async (payload: { agent?: any; messages?: any[] }, next: () => Promise<any>) => {
    const decision = await next()
    try {
      const agent = payload.agent
      if (memories === undefined || agent === undefined || decision?.kind !== 'enter') return decision
      if (excluded(agent.session?.meta?.agentPreset)) return decision
      const human = (payload.messages ?? []).filter(m => isHumanTurn({ type: 'user/message', data: m }))
      if (human.length === 0) return decision
      const s0 = scope(String(agent.session.id))
      // 新会话的第一轮：主人的会话先读日记（和上个会话最后的内容）；其他会话有上个会话的内容就带上
      let opening: unknown
      if (countRounds(agent.session) === 0 && pendingHumanTurn(agent.session)) {
        const carry = s0.umo ? takeCarry(s0.umo) : ''
        let text = ''
        if (s0.category === 'master' && get('diaryOnNewSession')) {
          const window = await contextWindow(agent)
          text = diaryBlock(diary.recentMonths(get('overviewMonths')), diary.recentDays(get('diaryDays')), carry, Math.floor(window * get('diaryBudgetPercent') / 100))
        } else if (carry !== '') {
          text = '<previous_session>\n这是上一个会话最后的聊天（会话换新了，接着聊就好，不用提这件事）：\n' + carry + '\n</previous_session>'
        }
        if (text !== '') {
          opening = createUserMessage({ content: [{ type: 'text', text }] as never, source: { kind: 'plugin:companion-memory' } })
          log('info', '会话 ' + agent.session.id + ' 是新会话，开头给了' + (s0.category === 'master' ? '日记' : '上个会话的内容') + '（' + text.length + ' 字）')
        }
      }
      const withOpening = opening === undefined ? decision : { ...decision, messages: [opening, ...decision.messages] }
      if (!get('recallEnabled')) return withOpening
      const query = queryText(human.map(m => (Array.isArray(m.content) ? m.content : []).filter((b: any) => b?.type === 'text').map((b: any) => String(b.text)).join('\n')).join('\n'))
      if (query === '') return withOpening
      const found = await search(s0, query, get('recallTopK'))
      if (found.length === 0) return withOpening
      const text = formatRecall(found)
      log('debug', '会话 ' + agent.session.id + ' 想起了 ' + found.length + ' 条记忆')
      return { ...withOpening, messages: [...withOpening.messages, createUserMessage({ content: [{ type: 'text', text }] as never, source: { kind: 'plugin:companion-memory' } })] }
    } catch (e) {
      log('warn', '召回记忆时出错，这一轮不带记忆：' + errText(e))
      return decision
    }
  }) as never)

  // 整理：截断/压缩之前先把要紧内容写进记忆
  ctx.on('companion/before-compact' as never, (async (p: BeforeCompactPayload) => {
    if (organizer === undefined || !get('organizeBeforeCompact')) return
    try {
      if (p.scope.qq && p.scope.umo) await organizer.organizeUmo(p.scope.umo, '压缩前')
      else if (!p.scope.qq) await organizer.flushDsh(p.sessionId, '压缩前', p.transcript)
    } catch (e) {
      log('warn', '压缩前整理失败（照常压缩）：' + errText(e))
    }
  }) as never)

  // dsh 里直接开的会话：从会话事件里攒聊天内容，到 N 轮就整理
  ctx.on('session/event' as never, ((session: any, event: any) => {
    if (organizer === undefined) return
    const id = String(session?.id ?? '')
    if (id === '' || id.startsWith('napcat-') || excluded(session?.meta?.agentPreset)) return
    if (event?.type !== 'user/message' && event?.type !== 'assistant/message') return
    const msg = event.data
    const human = event.type === 'user/message' && isHumanTurn(event)
    if (event.type === 'user/message' && !human) return
    const text = (Array.isArray(msg?.content) ? msg.content : []).filter((b: any) => b?.type === 'text').map((b: any) => String(b.text)).join('\n').trim()
    if (text === '') return
    if (scope(id).qq) return
    organizer.onDshLine(id, text, human, get('organizeEveryRounds'))
  }) as never)

  // 群聊之前 n 条：她参与群话题时，把她没看到的群消息一起给她（图片原图、语音转文字、视频截图都用插件一的媒体服务）
  ctx.on('napcat/prompt' as never, (async (payload: { info: { type: string; umo: string; groupId?: string; sessionId: string }; message: any; content: any[] }) => {
    try {
      const info = payload.info
      if (archive === undefined || info?.type !== 'group' || get('groupContextCount') <= 0) return
      const s: Scope = { category: 'group', qq: true, umo: info.umo, ...(info.groupId ? { groupId: info.groupId } : {}) }
      if (!archiveRule(s, defaults(), rules()).unwoken) return
      const umo = String(payload.message?.raw_message ? info.umo : info.umo)
      const rows = archive.unseen(umo, get('groupContextCount'), payload.message?.message_id !== undefined ? String(payload.message.message_id) : undefined)
      if (rows.length === 0) return
      const media = (napcat() as any)?.media as { convert?(components: any[], budget?: number): Promise<{ text: string; parts: any[]; used: number }> } | undefined
      let budget = get('groupContextImages')
      const lines: string[] = []
      const images: any[] = []
      for (const r of rows) {
        let extra = ''
        if (r.segments) {
          try {
            const all = JSON.parse(r.segments)
            // 收到时已经下载存好的图片直接用（QQ 链接可能已经过期）
            const local = Array.isArray(all) ? all.filter((c: any) => c?.type === 'Image' && typeof c._local === 'string') : []
            for (const c of local) {
              if (budget <= 0) break
              const path = join(mediaDir, String(c._local))
              if (!/^[0-9a-f]{64}\.[a-z0-9]+$/.test(String(c._local)) || !existsSync(path)) continue
              images.push({ type: 'image', mediaType: mimeOf(String(c._local)), data: readFileSync(path).toString('base64') })
              budget -= 1
              extra += ' [图片，见下面]'
            }
            const comps = Array.isArray(all) ? all.filter((c: any) => !(c?.type === 'Image' && typeof c._local === 'string')) : []
            if (media?.convert === undefined) throw new Error('没有插件一的媒体服务')
            if (Array.isArray(comps) && comps.some((c: any) => c?.type === 'Image' || c?.type === 'Record' || c?.type === 'Video')) {
              const got = await media.convert(comps, budget)
              budget -= got.used
              const imgCount = got.parts.filter((p: any) => p?.type === 'image').length
              if (imgCount > 0) extra += ' [图片×' + imgCount + '，见下面]'
              if (got.text) extra += ' ' + got.text
              images.push(...got.parts)
            }
          } catch (e) {
            log('debug', '群消息里的图片/语音没转出来：' + errText(e))
          }
        }
        lines.push('[' + (r.senderName || r.senderId) + '(' + r.senderId + ')] ' + (r.text || '').trim() + extra)
      }
      const head = { type: 'text', text: '<group_context>\n在这条消息之前，群里还有这些你没看到的消息（按时间顺序）：\n' + lines.join('\n') + '\n</group_context>' }
      const tail = images.length > 0 ? [{ type: 'text', text: '（下面是上面那些群消息里的图片）' }, ...images] : []
      payload.content.unshift(head, ...tail)
    } catch (e) {
      log('warn', '附带群聊之前的消息时出错：' + errText(e))
    }
  }) as never)
  //#endregion

  //#region 装工具：主人会话里改人格/核心记忆；所有会话（开了主动记忆时）回忆、记住、遗忘
  const toolDeps: ToolDeps = {
    persona, coreMaster, corePublic,
    isMaster: sessionId => get('selfEdit') && scope(sessionId).category === 'master',
    coreMaxBytes: () => get('coreMaxKB') * 1024,
    log,
  }
  const memoryToolDeps: MemoryToolDeps | undefined = memories === undefined ? undefined : {
    store: memories,
    scope,
    search: async (s, query, limit) => (await search(s, query, limit)).map(f => ({ id: f.memory.id, content: f.memory.content, scope: f.memory.scope, createdAt: f.memory.createdAt })),
    forgetMode: forgetModeOf,
    afterWrite,
    log,
  }
  const equipped = new WeakMap<object, Array<() => void>>()
  const equip = (agent: any): void => {
    if (agent === undefined || equipped.has(agent)) return
    const sessionId = String(agent.session?.id ?? '')
    if (excluded(agent.session?.meta?.agentPreset)) return
    const master = scope(sessionId).category === 'master'
    const defs = [
      ...(master ? [personaTool(toolDeps), coreTool(toolDeps)] : []),
      ...(get('activeMemory') && memoryToolDeps !== undefined ? [searchTool(memoryToolDeps), saveTool(memoryToolDeps), forgetTool(memoryToolDeps)] : []),
    ]
    if (defs.length === 0) return
    const tools = agent.ctx?.tools
    if (tools === undefined) {
      log('warn', '会话 ' + sessionId + ' 没有工具服务，装不了工具')
      return
    }
    const disposers: Array<() => void> = []
    for (const def of defs) {
      try {
        const off = tools.register(def)
        if (typeof off === 'function') disposers.push(off)
      } catch (e) {
        log('warn', '会话 ' + sessionId + ' 装工具 ' + def.name + ' 失败: ' + errText(e))
      }
    }
    equipped.set(agent, disposers)
    log('debug', '会话 ' + sessionId + ' 装上了工具：' + defs.map(d => d.name).join('、'))
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
  const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' }
  const mimeOf = (name: string): string => Object.entries(EXT).find(([, e]) => name.endsWith('.' + e))?.[0] ?? 'image/jpeg'
  /** 收到的图片下载存好（按内容的 SHA-256 命名），在存档的消息段里记下文件名。 */
  const saveImages = async (umo: string, messageId: string, comps: any[]): Promise<void> => {
    const media = (napcat() as any)?.media as { loadImage?(c: any): Promise<{ mediaType: string; data: string }> } | undefined
    if (media?.loadImage === undefined || archive === undefined) return
    let changed = false
    for (const c of comps) {
      if (c?.type !== 'Image' || c._local) continue
      try {
        const img = await media.loadImage(c)
        const bytes = Buffer.from(img.data, 'base64')
        if (bytes.length > 10 * 1024 * 1024) continue
        const name = createHash('sha256').update(bytes).digest('hex') + '.' + (EXT[img.mediaType] ?? 'jpg')
        mkdirSync(mediaDir, { recursive: true })
        const path = join(mediaDir, name)
        if (!existsSync(path)) writeAtomic(path, bytes)
        c._local = name
        changed = true
      } catch (e) {
        log('debug', '图片没下载下来：' + errText(e))
      }
    }
    if (changed) archive.updateSegments(umo, messageId, JSON.stringify(comps))
  }
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
    if (isGroup || info !== undefined) organizer?.rememberCategory(umo, s.category)
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
    if (get('archiveImages') && get('archiveEnabled') && !notice && abm.message_id !== undefined && Array.isArray(abm.message) && abm.message.some((c: any) => c?.type === 'Image')) {
      void saveImages(umo, String(abm.message_id), JSON.parse(segments ?? '[]'))
    }
  }) as never)
  ctx.on('napcat/sent' as never, ((p: { umo: string; session: { message_type: string; session_id: string }; text: string; time: number }) => {
    const isGroup = p.session?.message_type === 'GroupMessage'
    const info = (napcat() as any)?.sessionInfoByUmo?.(p.umo) as { sessionId?: string; selfId?: string; type?: string; adminPrivate?: boolean } | undefined
    if (info !== undefined) organizer?.rememberCategory(p.umo, info.type === 'group' ? 'group' : info.adminPrivate ? 'master' : 'private')
    store({
      umo: p.umo, kind: isGroup ? 'group' : 'private',
      ...(isGroup ? { groupId: p.session.session_id } : { userId: p.session.session_id }),
      time: p.time ?? Date.now(), direction: 'out',
      senderId: String(info?.selfId ?? 'self'), senderName: '她',
      woke: true, type: 'message', text: String(p.text ?? ''),
      ...(info?.sessionId ? { sessionId: info.sessionId } : {}),
    })
    // 每 N 轮整理一次（只算她一轮说完的回复）
    if ((p as { source?: string }).source !== 'service') organizer?.onReply(p.umo, get('organizeEveryRounds'))
  }) as never)
  //#endregion

  //#region 设置页用的接口：<dsh>/api/companion/…（挂在 dsh 的 /api 钩子上，要先登录）
  const DOC_NAMES = Object.keys(docs)
  /** 最近一次模型清理的建议（等主人勾选确认） */
  let lastCleanup: { at: number; suggestions: Array<{ id: number; reason: string; content: string }>; purged: number[] } | null = null
  let organizing: Promise<unknown> | undefined
  const runCleanup = async (): Promise<NonNullable<typeof lastCleanup>> => {
    if (memories === undefined) throw new Error('数据库没打开')
    const l = llm()
    const target = modelTarget()
    if (l === undefined || target === undefined) throw new Error('没有可用的模型')
    const forgotten = memories.list({ scope: 'master', status: 'forgotten', limit: 200 }).items
    if (forgotten.length === 0) return (lastCleanup = { at: Date.now(), suggestions: [], purged: [] })
    const picked = parseCleanup(await complete(l, target, cleanupPrompt(forgotten)), new Set(forgotten.map(m => m.id)))
    const suggestions = picked.map(p => ({ ...p, content: forgotten.find(m => m.id === p.id)?.content ?? '' }))
    const purged: number[] = []
    if (get('cleanupAutoPurge')) for (const sug of suggestions) if (memories.purge(sug.id)) purged.push(sug.id)
    log('info', '模型清理：建议彻底遗忘 ' + suggestions.length + ' 条' + (purged.length > 0 ? '，已直接删除 ' + purged.length + ' 条' : ''))
    return (lastCleanup = { at: Date.now(), suggestions, purged })
  }
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
    memory: memories?.stats() ?? null,
    pending: organizer?.pending() ?? null,
    index: indexer?.state() ?? null,
    embedKeySet: get('embedApiKey').trim() !== '',
    modelTarget: modelTarget() ?? null,
    cleanup: lastCleanup,
    diary: { days: diary.days().length, months: diary.months().length, latest: diary.days()[0] ?? null, nextDay: meta.get('maint:day') ?? null },
    maintenance: maintenance?.last ?? null,
    retired: archive?.retiredList() ?? [],
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
      const url = new URL(req.url ?? '/', 'http://localhost')
      if (req.method === 'GET' && parts[0] === 'memory' && parts.length === 1) {
        if (memories === undefined) return json(503, { error: '数据库没打开' })
        const status = url.searchParams.get('status')
        return json(200, memories.list({
          scope: url.searchParams.get('scope') || undefined,
          status: status === 'forgotten' || status === 'superseded' || status === 'all' ? status : 'active',
          q: url.searchParams.get('q') || undefined,
          limit: Number(url.searchParams.get('limit') ?? 50) || 50,
          offset: Number(url.searchParams.get('offset') ?? 0) || 0,
        }))
      }
      if (req.method === 'GET' && parts[0] === 'index') return json(200, indexer?.state() ?? null)
      if (req.method === 'GET' && parts[0] === 'diary') {
        if (parts.length === 1) return json(200, { days: diary.days().map(d => ({ date: d, length: (diary.readDay(d) ?? '').length })), months: diary.months().map(m => ({ date: m, length: (diary.readMonth(m) ?? '').length })) })
        const key = parts[1] ?? ''
        const text = /^\d{4}-\d{2}-\d{2}$/.test(key) ? diary.readDay(key) : /^\d{4}-\d{2}$/.test(key) ? diary.readMonth(key) : undefined
        return text === undefined ? json(404, { error: '没有这篇' }) : json(200, { date: key, text })
      }
      if (['diary', 'maintenance'].includes(parts[0] ?? '')) {
        if (req.method !== 'POST') return json(405, { error: '只支持 POST' })
        if (!String(req.headers['content-type'] ?? '').includes('application/json')) return json(415, { error: '需要 application/json' })
        const body = await readBody(req)
        if (parts[0] === 'maintenance') {
          if (maintenance === undefined) return json(503, { error: '数据库没打开' })
          // 测试用：环境变量 COMPANION_TEST_CLOCK=1 时可以指定"现在"（模拟过了很多天）
          const now = process.env.COMPANION_TEST_CLOCK === '1' && typeof body?.now === 'number' ? body.now : Date.now()
          const what = body?.what === 'diary' || body?.what === 'expire' ? body.what : 'all'
          const report = await maintenance.run(now, what)
          return json(200, { report, state: state() })
        }
        // diary
        if (parts[1] === 'import') {
          const files: Array<{ name?: string; text?: string }> = Array.isArray(body?.files) ? body.files : []
          const conflict = body?.conflict === 'overwrite' || body?.conflict === 'merge' ? body.conflict : 'skip'
          const results: Array<{ name: string; date?: string; result: string }> = []
          for (const f of files.slice(0, 400)) {
            const name = String(f.name ?? '')
            const text = String(f.text ?? '').trim()
            const date = guessDate(name, text)
            if (date === undefined || text === '') { results.push({ name, result: 'no-date' }); continue }
            const existing = diary.readDay(date)
            if (existing !== undefined && conflict === 'skip') { results.push({ name, date, result: 'skipped' }); continue }
            const content = existing !== undefined && conflict === 'merge' ? existing.trim() + '\n\n' + text : text
            diary.writeDay(date, content)
            memories?.add({ scope: 'master', kind: 'diary', content, importance: 0.8, trust: 1, writer: 'import' })
            results.push({ name, date, result: existing !== undefined ? conflict : 'added' })
          }
          afterWrite()
          log('info', '导入日记 ' + results.filter(r => r.result !== 'skipped' && r.result !== 'no-date').length + ' 篇')
          return json(200, { results })
        }
        const key = parts[1] ?? ''
        const isDay = /^\d{4}-\d{2}-\d{2}$/.test(key)
        const isMonth = /^\d{4}-\d{2}$/.test(key)
        if (!isDay && !isMonth) return json(400, { error: '日期格式不对' })
        if (parts[2] === 'delete') {
          const ok = isDay ? diary.deleteDay(key) : diary.deleteMonth(key)
          if (ok) log('info', '设置页删除了 ' + key + ' 的日记')
          return json(ok ? 200 : 404, { ok })
        }
        if (typeof body?.text !== 'string' || body.text.trim() === '') return json(400, { error: '内容是空的' })
        if (isDay) diary.writeDay(key, body.text)
        else diary.writeMonth(key, body.text)
        log('info', '设置页修改了 ' + key + ' 的日记')
        return json(200, { ok: true })
      }
      if (['memory', 'index', 'organize', 'cleanup'].includes(parts[0] ?? '')) {
        if (req.method !== 'POST') return json(405, { error: '只支持 POST' })
        if (!String(req.headers['content-type'] ?? '').includes('application/json')) return json(415, { error: '需要 application/json' })
        const body = await readBody(req)
        if (parts[0] === 'organize') {
          if (organizer === undefined) return json(503, { error: '数据库没打开' })
          if (organizing === undefined) organizing = organizer.organizeAll().then(r => { log('info', '手动整理完成：' + r.sessions + ' 个会话，新记了 ' + r.added + ' 条') }, e => { log('warn', '手动整理失败：' + errText(e)) }).finally(() => { organizing = undefined })
          if (body?.wait === true) await organizing
          return json(200, state())
        }
        if (parts[0] === 'cleanup') {
          if (!get('cleanupEnabled')) return json(400, { error: '先在设置里打开「模型清理」' })
          if (parts[1] === 'purge') {
            const ids: number[] = Array.isArray(body?.ids) ? body.ids.map(Number).filter(Number.isInteger) : []
            const allowed = new Set((lastCleanup?.suggestions ?? []).map(x => x.id))
            const done = ids.filter(id => allowed.has(id) && memories?.purge(id))
            if (lastCleanup) lastCleanup = { ...lastCleanup, purged: [...lastCleanup.purged, ...done] }
            log('info', '设置页确认彻底遗忘 ' + done.length + ' 条')
            return json(200, state())
          }
          await runCleanup()
          return json(200, state())
        }
        if (parts[0] === 'index') {
          if (indexer === undefined) return json(503, { error: '数据库没打开' })
          if (parts[1] === 'rebuild') indexer.start(true)
          else if (parts[1] === 'resume') indexer.start(false)
          else if (parts[1] === 'pause') indexer.pause()
          else if (parts[1] === 'cancel') indexer.cancel()
          else return json(404, { error: 'not found' })
          return json(200, indexer.state())
        }
        // memory
        if (memories === undefined) return json(503, { error: '数据库没打开' })
        if (parts[1] === 'add') {
          const scopeName = String(body?.scope ?? 'master')
          if (!/^(master|public|group:\d+|user:\d+)$/.test(scopeName)) return json(400, { error: '归属不对' })
          const kind = (KINDS as readonly string[]).includes(String(body?.kind)) ? body.kind as MemoryKind : 'other'
          const r = memories.add({ scope: scopeName, kind, content: String(body?.content ?? ''), importance: Number(body?.importance ?? 0.6), trust: defaultTrust('master', 'settings'), writer: 'settings' })
          afterWrite()
          return json(200, r)
        }
        const id = Number(parts[1])
        if (!Number.isInteger(id) || memories.get(id) === undefined) return json(404, { error: '没有这条记忆' })
        const action = parts[2]
        const ok = action === 'forget' ? memories.forget(id)
          : action === 'purge' ? memories.purge(id)
            : action === 'restore' ? memories.restore(id)
              : action === 'edit' ? memories.edit(id, String(body?.content ?? ''))
                : undefined
        if (ok === undefined) return json(404, { error: 'not found' })
        if (action === 'edit' || action === 'restore') afterWrite()
        log('info', '设置页对记忆 #' + id + ' 做了 ' + action)
        return json(ok ? 200 : 400, { ok })
      }
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
