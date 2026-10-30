// Public upstream documents only. Never execute page scripts or forward credentials.
type Load = (url: string) => Promise<{ text: string; json: any }>

export function normalizeDocument(body: string): string {
  const html = body.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  // Prefer article content over changing navigation, when a real article is present.
  const article = /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(html)?.[1]
  const content = article && article.replace(/<[^>]+>/g, '').trim().length >= 80 ? article : html
  return content.replace(/<(nav|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function readableDocument(text: string): boolean {
  return text.length >= 80 && !/you need to enable javascript|please enable javascript|enable javascript to (?:run|continue)|checking your browser|just a moment[.!]/i.test(text)
}

export function publicRedirectAllowed(from: URL, to: URL): boolean {
  if (to.protocol !== 'https:' || to.username || to.password || to.port && to.port !== '443') return false
  const origin = from.hostname.replace(/^www\./, ''), target = to.hostname.replace(/^www\./, '')
  if (target === origin || target.endsWith('.' + origin)) return true
  // Explicit, verified official documentation migrations, never arbitrary cross-site redirects.
  return [
    ['platform.moonshot.cn', 'platform.kimi.com'],
    ['platform.minimaxi.com', 'platform.minimax.cn'],
  ].some(([old, current]) => from.hostname === old && to.hostname === current && to.pathname.startsWith('/docs/'))
}

export function upstreamRequestError(error: unknown): string {
  const e = error as { name?: string; message?: string; cause?: { code?: string; errors?: Array<{ code?: string }> } }
  const codes = [e?.cause?.code, ...(e?.cause?.errors ?? []).map(x => x.code)].filter((x): x is string => !!x && /^[A-Z_0-9]+$/.test(x))
  if (e?.name === 'TimeoutError' || codes.includes('UND_ERR_CONNECT_TIMEOUT') || codes.includes('ETIMEDOUT')) return '请求超时（连接或读取未完成）'
  if (e?.name === 'AbortError') return '请求已取消'
  if (codes.length) return '网络请求失败（' + [...new Set(codes)].join('、') + '）'
  return e?.message === 'fetch failed' ? '网络请求失败（未获得HTTP响应）' : e?.message || '公开来源读取失败'
}

export async function officialDocument(url: string, load: Load): Promise<{ text: string; method: string }> {
  const u = new URL(url)
  if (['modelscope.cn', 'www.modelscope.cn'].includes(u.hostname) && u.pathname === '/docs/model-service/API-Inference/intro') {
    const metadata = await load('https://www.modelscope.cn/api/v1/document/main_doc_CN_prod')
    const prefix = metadata.json?.Data?.TargetPrefix
    // The official SPA publishes its current public Markdown bundle through this metadata.
    // Validate the exact CDN/path, so remote metadata cannot redirect us to a private or unrelated host.
    if (metadata.json?.Success !== true || typeof prefix !== 'string' || !/^https:\/\/resouces\.modelscope\.cn\/document\/docdata\/[A-Za-z0-9_-]+\/?$/.test(prefix)) throw new Error('魔搭官方文档目录无效或来源未获确认')
    const documentUrl = prefix.replace(/\/$/, '') + '/dist/model-service/API-Inference/intro/intro_CN.md'
    const body = (await load(documentUrl)).text
    if (/^\s*(?:<!doctype|<html)/i.test(body)) throw new Error('魔搭官方Markdown返回网页外壳，未取得正文')
    const text = normalizeDocument(body)
    if (!readableDocument(text)) throw new Error('魔搭官方Markdown缺少有效正文')
    return { text, method: '读取魔搭官方公开文档目录及Markdown正文；正文来源：' + documentUrl }
  }
  const text = normalizeDocument((await load(url)).text)
  if (!readableDocument(text)) throw new Error('官方页面缺少有效正文或需要脚本渲染')
  return { text, method: '直接读取官方资料' }
}
