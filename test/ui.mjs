// Real-browser checks against the disposable dsh e2e profile. Never target production.
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

export async function runUi(session) {
 const artifacts=fileURLToPath(new URL('../.cache/ui-artifacts/',import.meta.url));mkdirSync(artifacts,{recursive:true})
 const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
 const executablePath=process.env.CHROME_BIN || (process.platform==='darwin'&&existsSync(chrome)?chrome:undefined)
 const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})})
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1050},locale:'zh-CN'})
  await context.addCookies(session.cookie.split('; ').map(part=>{const i=part.indexOf('=');return{name:part.slice(0,i),value:part.slice(i+1),url:session.url}}))
  const page=await context.newPage(), errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto(session.url)
  await page.getByRole('button',{name:'插件',exact:true}).waitFor()
  await page.getByRole('button',{name:'继续',exact:true}).click({timeout:5000}).catch(()=>{})
  await page.getByRole('button',{name:'插件',exact:true}).click()
  await page.getByText('dsh-snowluma-companion',{exact:true}).click()
  const app=page.locator('.sc-app');await app.waitFor()
  assert.equal(await app.locator('.sc-nav-item').count(),9)
  assert.equal(await page.getByText('dsh-companion-core',{exact:true}).count(),0,'no second installed plugin entry')
  const navigate=async title=>{await app.locator('.sc-nav-item').filter({hasText:title}).click();await page.waitForTimeout(80)}
  const expand=async()=>{await app.getByRole('button',{name:'全部展开',exact:true}).click();await page.waitForFunction(()=>[...document.querySelectorAll('.sc-section:not([hidden])')].every(e=>e.open))}
  const collapse=async()=>{await app.getByRole('button',{name:'全部收起',exact:true}).click();await page.waitForFunction(()=>[...document.querySelectorAll('.sc-section:not([hidden])')].every(e=>!e.open))}
  await navigate('聊天与回复');await expand()
  const keyword=app.locator('#snowluma-bridge-wakeKeywords'), groupContext=app.locator('#companion-core-groupContextCount')
  const wakeValue='UI测试唤醒'+Date.now().toString(36), contextValue=String(Number(await groupContext.inputValue())===3?4:3)
  await keyword.fill(wakeValue);await groupContext.fill(contextValue)
  const save=app.getByRole('button',{name:'保存所有设置',exact:true})
  const min=app.locator('#snowluma-bridge-typingMinSeconds'), previous=await min.inputValue()
  await min.fill('-1');assert.ok(await save.isDisabled(),'invalid values block a combined save')
  await min.fill(previous);await save.click()
  await page.waitForFunction(()=>document.querySelector('.sc-save strong')?.textContent==='所有设置已保存')
  await page.reload();await page.getByRole('button',{name:'插件',exact:true}).click();await page.getByText('dsh-snowluma-companion',{exact:true}).click();await app.waitFor();await navigate('聊天与回复');await expand()
  assert.equal(await keyword.inputValue(),wakeValue);assert.equal(await groupContext.inputValue(),contextValue)
  await navigate('人格与核心记忆')
  const persona=app.locator('[data-section="companion-persona"]')
  if(!await persona.evaluate(e=>e.open))await persona.locator('summary').first().click()
  const editor=persona.locator('textarea').first();await editor.fill('UI 草稿：切换分组与收起不会丢失。')
  await persona.locator('summary').first().click();await persona.locator('summary').first().click()
  assert.equal(await editor.inputValue(),'UI 草稿：切换分组与收起不会丢失。')
  await navigate('图片、语音与视频');await navigate('人格与核心记忆')
  assert.equal(await editor.inputValue(),'UI 草稿：切换分组与收起不会丢失。')
  const search=app.getByRole('searchbox');await search.fill('语音')
  assert.ok(await app.locator('.sc-section:not([hidden])').count()>0)
  await search.fill('找不到的设置XYZ')
  assert.equal(await app.locator('.sc-section:not([hidden])').count(),0)
  await search.fill('');await navigate('连接与权限');await collapse()
  assert.equal(await app.locator('.sc-section[open]:not([hidden])').count(),0)
  await expand();assert.ok(await app.locator('.sc-section[open]:not([hidden])').count()>=3)
  await collapse();await app.locator('[data-section="bridge-access"]>summary').click()
  await collapse();await app.evaluate(el=>el.scrollIntoView({block:'start'}));await app.screenshot({path:join(artifacts,'settings-desktop.png')})
  await page.emulateMedia({colorScheme:'dark'});await app.screenshot({path:join(artifacts,'settings-dark.png')})
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150)
  assert.ok(await app.evaluate(el=>el.scrollWidth<=el.clientWidth+2),'settings must fit mobile width')
  await app.screenshot({path:join(artifacts,'settings-mobile.png')})
  // Exercise upload -> detected files -> multi-select -> actual selective restore, only in this disposable profile.
  await page.setViewportSize({width:1440,height:1050});await navigate('备份与迁移');await expand()
  const endpoint=path=>session.url+'api/companion/'+path
  const post=async(path,data)=>{const response=await page.request.post(endpoint(path),{data});assert.ok(response.ok(),path);return response.json()}
  const state=async()=>{const response=await page.request.get(endpoint('state'));assert.ok(response.ok());return response.json()}
  const before=await state()
  const made=await post('backup/create',{items:['persona','core','memory','diary']})
  const download=await page.request.get(endpoint('backup/file/'+made.name));assert.ok(download.ok())
  await post('doc/persona',{text:'UI restore: persona changed after backup'})
  await post('doc/core-master',{text:'UI restore: core changed after backup'})
  await post('memory/add',{scope:'master',content:'UI restore: this unselected memory must survive',kind:'fact',importance:0.6})
  const changed=await state()
  const restore=app.locator('[data-section="companion-restoreSec"]')
  await restore.locator('input[type=file]').setInputFiles({name:made.name,mimeType:'application/gzip',buffer:await download.body()})
  await restore.getByText('备份内容识别结果',{exact:true}).waitFor()
  const choices=restore.locator('.compc-restore-choice')
  assert.equal(await choices.locator('input[type=checkbox]').count(),4)
  const confirm=choices.getByRole('button',{name:'恢复所选项目（先备份当前数据）',exact:true})
  assert.ok(await confirm.isDisabled(),'restore requires explicit selection')
  await choices.getByRole('button',{name:'全选恢复项目',exact:true}).click()
  assert.equal(await choices.locator('input:checked').count(),4)
  await choices.getByRole('button',{name:'清空选择',exact:true}).click()
  for(const id of ['persona','core'])await choices.locator('[data-item="'+id+'"] input').check()
  assert.equal(await choices.locator('input:checked').count(),2)
  assert.equal((await state()).docs.persona.text,changed.docs.persona.text,'upload and preview must not restore yet')
  await choices.getByText('查看识别到的文件',{exact:true}).click()
  assert.ok(await choices.getByText('persona/persona.md',{exact:true}).isVisible())
  assert.ok(await choices.getByText('core/master.md',{exact:true}).isVisible())
  await choices.getByText('查看识别到的文件',{exact:true}).click()
  await choices.screenshot({path:join(artifacts,'restore-preview.png')})
  await confirm.click()
  let restored
  for(let i=0;i<90;i++){
   await page.waitForTimeout(500)
   try{const next=await state();if(next.lastImport?.at!==before.lastImport?.at && next.lastImport?.plan?.items.join(',')==='persona,core'){restored=next;break}}catch{}
  }
  assert.ok(restored,'selected restore completes after plugin reload')
  assert.equal(restored.docs.persona.text,before.docs.persona.text)
  assert.equal(restored.docs['core-master'].text,before.docs['core-master'].text)
  assert.deepEqual(restored.memory,changed.memory,'unselected memory remains unchanged')
  assert.equal(restored.diary.days,changed.diary.days,'unselected diary remains unchanged')
  await page.waitForFunction(()=>document.querySelector('.compc-restore-choice')===null)
  await navigate('人格与核心记忆')
  assert.equal(await editor.inputValue(),before.docs.persona.text,'selected editor replaces its stale draft after restore')
  console.log('[ui] Uploaded .tar.gz, detected payload files, explicit multi-select and real persona/core restore passed; unselected memory and diary preserved')
  assert.deepEqual(errors,[])
  console.log('[ui] Single entry, nine groups, fold/search, two-module save, validation, draft retention, desktop/mobile rendering passed')
 } finally {await browser.close()}
}
if(process.argv[1]===fileURLToPath(import.meta.url))await runUi(JSON.parse(readFileSync(new URL('../.cache/ui-session.json',import.meta.url),'utf8')))
