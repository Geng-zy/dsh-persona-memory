// 移植自 AstrBot（AGPL-3.0-or-later）：
//   astrbot/core/utils/quoted_message/chain_parser.py、extractor.py、onebot_client.py
// 把被引用的消息（包括聊天记录、记录里套着的记录）整理成文字和图片，交给模型。
// AstrBot 在流水线里做这件事，结果写成 <Quoted Message>(昵称): 内容</Quoted Message>。

import type { Component } from './components.js'

export interface QuotedSettings {
  /** max_component_chain_depth */
  maxComponentChainDepth: number
  /** max_forward_node_depth */
  maxForwardNodeDepth: number
  /** max_forward_fetch */
  maxForwardFetch: number
}

/** AstrBot 默认值（quoted_message_parser） */
export const QUOTED_DEFAULTS: QuotedSettings = { maxComponentChainDepth: 4, maxForwardNodeDepth: 8, maxForwardFetch: 32 }

type CallAction = (action: string, params: Record<string, unknown>) => Promise<any>

interface ParsedPayload {
  text: string | null
  forwardIds: string[]
  imageRefs: string[]
}

const FORWARD_PLACEHOLDER = /^(?:[([]?[^\]:)]*[)\]]?\s*:\s*)?\[(?:forward message|转发消息|合并转发)\]$/i
const IMAGE_EXT = /\.(?:png|jpe?g|gif|webp|bmp|heic|heif)(?:$|[?#])/i

function dedupe(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    const s = v.trim()
    if (s === '' || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

function joinParts(parts: string[]): string | null {
  const text = parts.join('').trim()
  return text === '' ? null : text
}

function isForwardPlaceholderOnly(text: string | null): boolean {
  if (typeof text !== 'string') return false
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== '')
  return lines.length > 0 && lines.every(l => FORWARD_PLACEHOLDER.test(l))
}

//#region 组件链（Reply.chain 里已经转换好的组件）

function imageRefsFromChain(chain: unknown, depth: number, s: QuotedSettings): string[] {
  if (!Array.isArray(chain) || depth > s.maxComponentChainDepth) return []
  const refs: string[] = []
  for (const seg of chain as Component[]) {
    if (seg.type === 'Image') {
      for (const c of [seg.url, seg.file, seg.path]) {
        if (typeof c === 'string' && c.trim() !== '') {
          refs.push(c.trim())
          break
        }
      }
    } else if (seg.type === 'Reply') {
      refs.push(...imageRefsFromReply(seg, depth + 1, s))
    } else if (seg.type === 'Node') {
      refs.push(...imageRefsFromChain(seg.content, depth + 1, s))
    } else if (seg.type === 'Nodes') {
      for (const node of seg.nodes ?? []) refs.push(...imageRefsFromChain(node.content, depth + 1, s))
    }
  }
  return dedupe(refs)
}

function textFromChain(chain: unknown, depth: number, s: QuotedSettings): string | null {
  if (!Array.isArray(chain) || depth > s.maxComponentChainDepth) return null
  const parts: string[] = []
  for (const seg of chain as Component[]) {
    if (seg.type === 'Plain') {
      if (seg.text) parts.push(seg.text)
    } else if (seg.type === 'At') {
      // AstrBot 的 AtAll 是 At 的子类，先命中 At 分支
      if (seg.name) parts.push('@' + seg.name)
      else if (seg.qq) parts.push('@' + seg.qq)
    } else if (seg.type === 'Image') {
      parts.push('[Image]')
    } else if (seg.type === 'Video') {
      parts.push('[Video]')
    } else if (seg.type === 'File') {
      parts.push('[File:' + (seg.name || 'file') + ']')
    } else if (seg.type === 'Forward') {
      parts.push('[Forward Message]')
    } else if (seg.type === 'Reply') {
      const nested = textFromReply(seg, depth + 1, s)
      if (nested) parts.push(nested)
    } else if (seg.type === 'Node') {
      const sender = seg.name || seg.uin || 'Unknown User'
      const nodeText = textFromChain(seg.content, depth + 1, s)
      if (nodeText) parts.push(sender + ': ' + nodeText)
    } else if (seg.type === 'Nodes') {
      for (const node of seg.nodes ?? []) {
        const sender = node.name || node.uin || 'Unknown User'
        const nodeText = textFromChain(node.content, depth + 1, s)
        if (nodeText) parts.push(sender + ': ' + nodeText)
      }
    }
  }
  return joinParts(parts)
}

function imageRefsFromReply(reply: Component, depth: number, s: QuotedSettings): string[] {
  for (const attr of ['chain', 'message', 'origin', 'content']) {
    const refs = imageRefsFromChain(reply[attr], depth, s)
    if (refs.length > 0) return refs
  }
  return []
}

function textFromReply(reply: Component, depth: number, s: QuotedSettings): string | null {
  for (const attr of ['chain', 'message', 'origin', 'content']) {
    const text = textFromChain(reply[attr], depth, s)
    if (text) return text
  }
  if (typeof reply.message_str === 'string' && reply.message_str.trim() !== '') return reply.message_str.trim()
  return null
}

//#endregion

//#region OneBot 原始数据（get_msg / get_forward_msg 的返回）

function unwrap(payload: unknown): Record<string, any> {
  if (payload === null || typeof payload !== 'object') return {}
  const data = (payload as Record<string, any>).data
  return data !== null && typeof data === 'object' && !Array.isArray(data) ? data : payload as Record<string, any>
}

function textFromMultimsgJson(raw: string): string | null {
  let parsed: any
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (parsed === null || typeof parsed !== 'object' || parsed.app !== 'com.tencent.multimsg') return null
  if (parsed.config?.forward !== 1) return null
  const news = parsed.meta?.detail?.news
  if (!Array.isArray(news)) return null
  const texts: string[] = []
  for (const item of news) {
    if (typeof item?.text !== 'string') continue
    const cleaned = item.text.trim().replaceAll('[图片]', '').trim()
    if (cleaned) texts.push(cleaned)
  }
  return texts.join('\n').trim() || null
}

/**
 * 把一串 OneBot 消息段写成文字。depth 是聊天记录套了几层（缩进用）。
 * 本插件改动：聊天记录段（forward）自带 content 时直接展开，不再只留 id 等着再去取（NapCat 里面那层的 id
 * 往往取不到：「消息已过期或者为内层消息」）；NapCat get_forward_msg 把里面套着的记录写成 node 段，也展开。
 */
function parseSegments(segments: unknown[], s: QuotedSettings, depth = 0): ParsedPayload {
  const textParts: string[] = []
  const forwardIds: string[] = []
  const imageRefs: string[] = []
  const nested = (nodes: unknown[]): void => {
    const p = textForwardImagesFromNodes(nodes, depth + 1, s)
    textParts.push('[聊天记录]\n' + (p.text ?? '  '.repeat(depth + 1) + '[Forward Message]'))
    forwardIds.push(...p.forwardIds)
    imageRefs.push(...p.imageRefs)
  }
  let nodeRun: unknown[] = []
  const flushNodes = (): void => { if (nodeRun.length > 0) { nested(nodeRun); nodeRun = [] } }
  for (const seg of segments) {
    if (seg === null || typeof seg !== 'object') continue
    const type = (seg as any).type
    const data = (seg as any).data !== null && typeof (seg as any).data === 'object' ? (seg as any).data : {}
    // 连在一起的 node 段是一份聊天记录（NapCat 把套着的记录写成这样）
    if (type === 'node') { nodeRun.push(seg); continue }
    flushNodes()
    if (type === 'text' || type === 'plain') {
      if (typeof data.text === 'string' && data.text) textParts.push(data.text)
    } else if (type === 'image') {
      textParts.push('[Image]')
      const c = data.url || data.file
      if (typeof c === 'string' && c.trim()) imageRefs.push(c.trim())
    } else if (type === 'video') {
      textParts.push('[Video]')
    } else if (type === 'file') {
      const name = data.name || data.file_name || data.file || 'file'
      textParts.push('[File:' + name + ']')
      if (typeof data.url === 'string' && data.url.trim() && IMAGE_EXT.test(data.url)) imageRefs.push(data.url.trim())
      if (typeof data.file === 'string' && data.file.trim() && IMAGE_EXT.test(String(data.name || data.file_name || data.file))) imageRefs.push(data.file.trim())
    } else if (type === 'forward' || type === 'forward_msg' || type === 'nodes') {
      const content = Array.isArray(data.content) ? data.content : Array.isArray(data.messages) ? data.messages : undefined
      const fid = data.id ?? data.message_id
      if (content !== undefined && content.length > 0) {
        nested(content)
      } else if ((typeof fid === 'string' || typeof fid === 'number') && String(fid)) {
        // 没带内容：先占位，稍后用 get_forward_msg 取
        textParts.push('[聊天记录]')
        forwardIds.push(String(fid))
      }
    } else if (type === 'json') {
      if (typeof data.data === 'string' && data.data.trim()) {
        const t = textFromMultimsgJson(data.data.replaceAll('&#44;', ','))
        if (t) textParts.push(t)
      }
    }
  }
  flushNodes()
  return { text: joinParts(textParts), forwardIds, imageRefs: dedupe(imageRefs) }
}

/**
 * 聊天记录里的一条条消息 → 「名字: 内容」，按层数缩进。认两种写法：
 *   - OneBot 消息：{ sender: { nickname, card, user_id }, message | content }
 *   - NapCat get_forward_msg 的节点：{ type: 'node', data: { user_id, nickname, message | content } }
 */
function textForwardImagesFromNodes(nodes: unknown[], depth: number, s: QuotedSettings): ParsedPayload {
  if (!Array.isArray(nodes)) return { text: null, forwardIds: [], imageRefs: [] }
  const indent = '  '.repeat(depth)
  if (depth > s.maxForwardNodeDepth) return { text: indent + '[聊天记录套得太深，没有展开]', forwardIds: [], imageRefs: [] }
  const texts: string[] = []
  const forwardIds: string[] = []
  const imageRefs: string[] = []
  for (const item of nodes) {
    if (item === null || typeof item !== 'object') continue
    const node: any = (item as any).type === 'node' && (item as any).data !== null && typeof (item as any).data === 'object' ? (item as any).data : item
    const sender = node.sender !== null && typeof node.sender === 'object' ? node.sender : {}
    const senderName = sender.card || sender.nickname || node.nickname || node.name || sender.user_id || node.user_id || node.uin || 'Unknown User'
    let raw = Array.isArray(node.message) && node.message.length > 0 ? node.message : node.content ?? node.message ?? []
    let chain: unknown[] = []
    if (Array.isArray(raw)) {
      chain = raw
    } else if (typeof raw === 'string') {
      raw = raw.trim()
      if (raw) {
        let parsed: unknown
        try {
          parsed = JSON.parse(raw)
        } catch {
          parsed = undefined
        }
        chain = Array.isArray(parsed) ? parsed : [{ type: 'text', data: { text: raw } }]
      }
    }
    const p = parseSegments(chain, s, depth)
    if (p.text) {
      // 多行内容后面几行也缩进；套着的记录自己已经带了更深的缩进
      const lines = p.text.split('\n')
      texts.push(indent + senderName + ': ' + lines[0] + lines.slice(1).map(l => '\n' + (l.startsWith(indent + '  ') ? l : indent + '  ' + l)).join(''))
    }
    forwardIds.push(...p.forwardIds)
    imageRefs.push(...p.imageRefs)
  }
  return { text: texts.join('\n').trim() === '' ? null : texts.join('\n'), forwardIds: dedupe(forwardIds), imageRefs: dedupe(imageRefs) }
}

function parseGetMsg(payload: unknown, s: QuotedSettings): ParsedPayload {
  const data = unwrap(payload)
  const segments = data.message || data.messages
  if (Array.isArray(segments)) return parseSegments(segments, s)
  let text: string | null = null
  if (typeof segments === 'string' && segments.trim()) text = segments.trim()
  else if (typeof data.raw_message === 'string' && data.raw_message.trim()) text = data.raw_message.trim()
  return { text, forwardIds: [], imageRefs: [] }
}

function parseGetForward(payload: unknown, s: QuotedSettings): ParsedPayload {
  const data = unwrap(payload)
  const nodes = data.messages || data.message || data.nodes || data.nodeList || data.content
  if (!Array.isArray(nodes)) return { text: null, forwardIds: [], imageRefs: [] }
  return textForwardImagesFromNodes(nodes, 0, s)
}

//#endregion

/** OneBotClient._call_action_compat：message_id / id，字符串和数字都试一遍。都失败时 errors 里记下最后一个错误。 */
async function callCompat(callAction: CallAction, action: string, id: string | number, errors?: string[]): Promise<Record<string, any> | null> {
  const idStr = String(id).trim()
  if (idStr === '') return null
  const tries: Array<Record<string, unknown>> = [{ message_id: idStr }, { id: idStr }]
  if (/^\d+$/.test(idStr)) tries.push({ message_id: Number(idStr) }, { id: Number(idStr) })
  let last = '没有返回内容'
  for (const params of tries) {
    try {
      const result = await callAction(action, params)
      if (result !== null && typeof result === 'object') return result
    } catch (e) {
      // 换下一种参数再试
      last = e instanceof Error ? e.message : String(e)
    }
  }
  errors?.push(action + '(' + idStr + ')：' + last)
  return null
}

/** 出错时给日志看的原始数据：get_msg 返回里的聊天记录段（截短） */
function forwardSegmentsRaw(payload: unknown): string {
  const segs = unwrap(payload).message
  const fw = Array.isArray(segs) ? segs.filter((x: any) => x?.type === 'forward' || x?.type === 'node' || x?.type === 'json') : segs
  return JSON.stringify(fw ?? null).slice(0, 800)
}

/** _collect_text_and_images_from_forward_ids：逐个展开聊天记录，里面只给了 id 的记录也继续取。 */
async function collectForwards(callAction: CallAction, ids: string[], s: QuotedSettings, errors: string[] = []): Promise<{ texts: string[]; imageRefs: string[] }> {
  const texts: string[] = []
  const imageRefs: string[] = []
  const pending = ids.map(i => String(i).trim()).filter(i => i !== '')
  const seen = new Set<string>()
  let fetched = 0
  while (pending.length > 0 && fetched < s.maxForwardFetch) {
    const id = pending.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    fetched += 1
    const payload = await callCompat(callAction, 'get_forward_msg', id, errors)
    if (!payload) continue
    const p = parseGetForward(payload, s)
    if (p.text) texts.push(p.text)
    else errors.push('get_forward_msg(' + id + ')：返回里没认出消息（' + JSON.stringify(payload).slice(0, 300) + '）')
    imageRefs.push(...p.imageRefs)
    for (const nested of p.forwardIds) if (!seen.has(nested)) pending.push(nested)
  }
  return { texts, imageRefs: dedupe(imageRefs) }
}

export interface QuotedContent {
  /** 交给模型的文字：<Quoted Message>(昵称): 内容</Quoted Message> */
  text: string
  /** 引用里的图片地址（含聊天记录里的） */
  imageRefs: string[]
  /** 取聊天记录时出的错（给日志看） */
  errors?: string[]
}

/**
 * 整理消息里第一个引用（AstrBot 只处理第一个）：
 * 文字优先用转换时已取回的内容；只有"[转发消息]"占位时才调 get_msg 再展开聊天记录。
 */
export async function extractQuoted(message: Component[], callAction: CallAction, s: QuotedSettings = QUOTED_DEFAULTS): Promise<QuotedContent | null> {
  const reply = message.find(c => c.type === 'Reply')
  if (reply === undefined) return null
  const embeddedText = textFromReply(reply, 0, s)
  const embeddedImages = imageRefsFromReply(reply, 0, s)
  const replyId = reply.id !== undefined && reply.id !== null ? String(reply.id).trim() : ''

  let text = embeddedText
  let direct: ParsedPayload = { text: null, forwardIds: [], imageRefs: [] }
  let forwards = { texts: [] as string[], imageRefs: [] as string[] }
  const errors: string[] = []
  if (replyId !== '') {
    // 图片总要完整取一次（AstrBot images() 用 fetch_remote=True）
    const payload = await callCompat(callAction, 'get_msg', replyId)
    if (payload) {
      direct = parseGetMsg(payload, s)
      forwards = await collectForwards(callAction, direct.forwardIds, s, errors)
      if (direct.forwardIds.length > 0 && forwards.texts.length === 0) errors.push('get_msg(' + replyId + ') 里的聊天记录段：' + forwardSegmentsRaw(payload))
    }
    if (!(embeddedText && !isForwardPlaceholderOnly(embeddedText))) {
      const parts: string[] = []
      if (direct.text) parts.push(direct.text)
      parts.push(...forwards.texts)
      text = parts.join('\n').trim() || embeddedText
    }
  }
  const sender = reply.sender_nickname ? '(' + reply.sender_nickname + '): ' : ''
  const body = text || reply.message_str || '[Empty Text]'
  return {
    text: '<Quoted Message>\n' + sender + body + '\n</Quoted Message>',
    imageRefs: dedupe([...embeddedImages, ...direct.imageRefs, ...forwards.imageRefs]),
    ...(errors.length > 0 ? { errors } : {}),
  }
}

/**
 * 本插件新增（AstrBot 不展开直接发来的聊天记录）：
 * 消息本身带的聊天记录（forward 段）同样展开，写成 <Forward Message>…</Forward Message>。
 * 先用 get_msg 取这条消息本身（NapCat 在 get_msg 里会把聊天记录的内容一起带上），
 * 没带内容再用 get_forward_msg 按 id 取。都取不到时把 NapCat 的原始返回写进 errors，方便查。
 */
export async function extractForwards(message: Component[], callAction: CallAction, s: QuotedSettings = QUOTED_DEFAULTS, messageId?: string | number): Promise<QuotedContent | null> {
  const ids = message.filter(c => c.type === 'Forward' && c.id !== undefined && c.id !== null).map(c => String(c.id))
  if (ids.length === 0) return null
  const errors: string[] = []
  let rawGetMsg = ''
  if (messageId !== undefined && String(messageId).trim() !== '') {
    const payload = await callCompat(callAction, 'get_msg', messageId, errors)
    if (payload) {
      const p = parseGetMsg(payload, s)
      // 只有聊天记录都带了内容（没有剩下要按 id 取的）才算拿到了
      if (p.forwardIds.length === 0 && p.text && !/^\s*\[聊天记录\]\s*$/.test(p.text)) {
        return { text: '<Forward Message>\n' + p.text + '\n</Forward Message>', imageRefs: p.imageRefs }
      }
      rawGetMsg = forwardSegmentsRaw(payload)
    }
  }
  const { texts, imageRefs } = await collectForwards(callAction, ids, s, errors)
  if (texts.length === 0 && rawGetMsg !== '') errors.push('get_msg(' + messageId + ') 里的聊天记录段：' + rawGetMsg)
  const body = texts.join('\n').trim() || '[Forward Message]'
  return { text: '<Forward Message>\n' + body + '\n</Forward Message>', imageRefs, ...(errors.length > 0 ? { errors } : {}) }
}
