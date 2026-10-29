import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// Exercise the actual installed dsh transport, without calling a paid model or editing a session.
test('ModelScope reasoning transport retains instructions and avoids unsupported developer role', async () => {
  const root = join(import.meta.dirname, '../.cache/test-env/dsh/node_modules/.pnpm')
  const dir = readdirSync(root).find(n => n.startsWith('@earendil-works+pi-ai@'))
  const path = join(root, dir, 'node_modules/@earendil-works/pi-ai/dist/api/openai-completions.js')
  assert.ok(existsSync(path), 'run setup-test-env before testing the installed transport')
  const { convertMessages } = await import(pathToFileURL(path).href)
  const model = { id: 'deepseek-ai/DeepSeek-V4.1-Flash-1017', provider: 'modelscope', api: 'openai-completions', reasoning: true, input: ['text'], contextWindow: 1000000, maxTokens: 4096, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }
  const context = { messages: [
    { role: 'system', content: 'Current persona and core memory.', timestamp: 0 },
    { role: 'user', content: 'old question', timestamp: 1 },
    { role: 'assistant', content: [{ type: 'text', text: 'old answer' }], api: model.api, provider: model.provider, model: model.id, timestamp: 2, stopReason: 'stop', usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } },
    { role: 'system', content: [{ type: 'text', text: 'Current persona and core memory. Updated runtime instructions.' }], timestamp: 3 },
    { role: 'user', content: 'new question', timestamp: 4 },
  ] }
  const before = structuredClone(context)
  const rejected = convertMessages(model, context, { supportsDeveloperRole: true }, {})
  assert.ok(rejected.some(m => m.role === 'developer'), 'reproduces the rejected provider payload')
  const compatible = convertMessages(model, context, { supportsDeveloperRole: false }, {})
  assert.ok(compatible.every(m => m.role !== 'developer'))
  assert.ok(compatible.some(m => m.role === 'system' && JSON.stringify(m.content).includes('persona')))
  assert.ok(JSON.stringify(compatible).includes('Updated runtime instructions.'))
  assert.ok(JSON.stringify(compatible).includes('old answer'))
  assert.ok(JSON.stringify(compatible).includes('new question'))
  assert.deepEqual(context, before, 'history is never rewritten')
})
