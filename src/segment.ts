// 本插件新增：分段发送。把她一次的回复拆成几条 QQ 消息，像真人一样一句一条地发。
// 规则：
//   - 按换行拆，空行去掉，每段去掉首尾空白；
//   - ``` 包起来的代码块整段算一条，不拆；
//   - 最多拆成 maxSegments 条，多出来的并进最后一条（用换行连着），免得刷屏；
//   - 主人私聊、其他私聊、群聊可以分别开关（默认只有主人私聊开）。
// 每一段各自走发消息节奏（打字等待、群里的频率），所以段和段之间也有自然的停顿。

export interface SegmentSettings {
  adminPrivate: boolean
  private: boolean
  group: boolean
  /** 最多拆成几条（至少 1） */
  maxSegments: number
  /** 拆开发时每一条最多等几秒打字 */
  maxSecondsPerSegment: number
}

/** 这个会话要不要分段。 */
export function segmentEnabled(s: SegmentSettings, kind: { group: boolean; adminPrivate: boolean }): boolean {
  return kind.group ? s.group : kind.adminPrivate ? s.adminPrivate : s.private
}

/** 把一次回复拆成几段。 */
export function splitReply(text: string, maxSegments: number): string[] {
  const parts: string[] = []
  let code: string[] | undefined
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (code !== undefined) {
      code.push(raw)
      if (raw.trim().startsWith('```')) { parts.push(code.join('\n')); code = undefined }
      continue
    }
    if (raw.trim().startsWith('```')) { code = [raw]; continue }
    const line = raw.trim()
    if (line !== '') parts.push(line)
  }
  if (code !== undefined) parts.push(code.join('\n'))
  const max = Math.max(1, Math.floor(maxSegments))
  if (parts.length <= max) return parts.length > 0 ? parts : [text.trim()]
  return [...parts.slice(0, max - 1), parts.slice(max - 1).join('\n')]
}
