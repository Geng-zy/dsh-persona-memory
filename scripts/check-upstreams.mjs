#!/usr/bin/env node
// 检查各个上游有没有新版本：拿最新版本和 upstreams.json 里的 aligned 比较。
// 有新版本不代表一定要改代码，但每一个都要按交接文档「什么时候要更新代码」一节逐项判断并记录结论。
// 用法：node scripts/check-upstreams.mjs（依赖也要查：pnpm outdated）。在 Claude Code 沙盒里要放到沙盒外跑。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const base = JSON.parse(readFileSync(join(ROOT, 'upstreams.json'), 'utf-8')).upstreams

const headers = { 'user-agent': 'dsh-companion-core', accept: 'application/vnd.github+json' }
if (process.env.GITHUB_TOKEN) headers.authorization = 'Bearer ' + process.env.GITHUB_TOKEN
const get = async (url, raw = false) => {
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(url + ' → HTTP ' + res.status)
  return raw ? res.text() : res.json()
}

const checks = {
  dsh: async () => {
    const tags = (await get('https://registry.npmjs.org/@deepseek-ai/dsh'))['dist-tags']
    return { latest: tags.latest, note: 'next=' + tags.next + ' alpha=' + tags.alpha }
  },
  'snowluma-bridge': async () => {
    const tags = await get('https://api.github.com/repos/Geng-zy/dsh-snowluma-bridge/tags?per_page=1')
    return { latest: tags[0]?.name ?? '（没有标签）', note: '插件一，本插件用它的事件和 ctx.snowluma' }
  },
  node: async () => {
    const list = await get('https://nodejs.org/dist/index.json')
    return { latest: list.find(r => r.version.startsWith('v24.')).version.slice(1) }
  },
}

let changed = 0
for (const [name, check] of Object.entries(checks)) {
  try {
    const { latest, note } = await check()
    const aligned = base[name]?.aligned
    const same = latest === aligned
    if (!same) changed += 1
    console.log((same ? '  一致  ' : '★有新版') + '  ' + name.padEnd(14) + ' 对齐 ' + String(aligned).padEnd(14) + ' 最新 ' + latest + (note ? '（' + note + '）' : ''))
  } catch (e) {
    changed += 1
    console.log('✗查不到  ' + name.padEnd(14) + ' ' + (e instanceof Error ? e.message : String(e)))
  }
}
console.log()
console.log(changed === 0 ? '上游都没有新版本。还要运行 pnpm outdated 看依赖。' : '有 ' + changed + ' 项需要按交接文档逐项判断。还要运行 pnpm outdated 看依赖。')
