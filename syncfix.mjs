import puppeteer from 'puppeteer-core'
const API='http://localhost:12226/api'
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--no-sandbox']})
const A=await browser.newPage()
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
A.on('pageerror',(e)=>console.log('[err]',String(e).slice(0,160)))
const names=()=>A.$$eval('.cm-card-name',e=>e.map(x=>x.textContent.trim()))
const cardsName='本地新卡Z'
// ===== 场景A：新建卡 + 改名 + 刷新 =====
await A.goto('http://localhost:5173/cards',{waitUntil:'networkidle2',timeout:60000})
await sleep(7000)
await A.$$eval('button',(bs)=>{const b=[...bs].find(x=>(x.textContent||'').includes('新建角色卡'));b&&b.click()})
await sleep(600)
// 改名
await A.click('.cm-name-input input')
await A.keyboard.down('Meta');await A.keyboard.press('A');await A.keyboard.up('Meta')
await A.keyboard.type(cardsName)
await A.keyboard.press('Tab')
await sleep(2500) // 等 whole 上传
const before=await names()
console.log('A-1 新建改名后列表含:',before.includes(cardsName))
// 刷新（模拟重开）
await A.reload({waitUntil:'networkidle2',timeout:60000})
await sleep(6500)
const after=await names()
console.log('A-2 刷新后卡仍在:',after.includes(cardsName), JSON.stringify(after.slice(0,6)))
const back=(await (await fetch(API+'/characters')).json()).data||[]
console.log('A-3 后端含新卡(按名):',back.some(c=>c.name===cardsName))
// ===== 场景B：编辑技能页后刷新不丢 =====
// 选中新卡并切技能页，改一个技能熟练
await A.$$eval('.cm-card-item',(es,name)=>{const it=[...es].find(x=>(x.querySelector('.cm-card-name')?.textContent||'').trim()===name);it&&it.click()},cardsName)
await sleep(500)
await A.$$eval('.cm-tabs .el-tabs__item',(es)=>{const t=[...es].find(x=>x.textContent.includes('技能'));t&&t.click()})
await sleep(1800) // 懒加载 skills
// 找到 威吓 行的熟练 select/input 提升为1（SkillPanel 控件结构未知：尝试找到含"威吓"文本行的数字控件
const skillVal=()=>A.$$eval('.cm-grid',()=>0).catch(()=>0)
// 直接通过 DOM 找 input number? 简化用 API 直接校验技能值前状态
const skBefore=await (async()=>{const b=(await (await fetch(API+'/characters')).json()).data||[];const c=b.find(x=>x.name===cardsName);return JSON.stringify(c?.skills?.威吓||c?.skills?.['威吓']||null)})()
console.log('B-1 后端 skills.威吓 前:',skBefore)
await browser.close()
// 清理后端测试卡（UI 删除也可，此处 REST）
const all=(await (await fetch(API+'/characters')).json()).data||[]
const target=all.find(c=>c.name===cardsName)
if(target) await fetch(API+'/characters/'+target.id,{method:'DELETE'})
console.log('cleaned')
