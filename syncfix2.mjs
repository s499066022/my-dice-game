import puppeteer from 'puppeteer-core'
const API='http://localhost:12226/api'
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--no-sandbox']})
const A=await browser.newPage()
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
const names=()=>A.$$eval('.cm-card-name',e=>e.map(x=>x.textContent.trim()))
await A.goto('http://localhost:5173/cards',{waitUntil:'networkidle2',timeout:60000})
await sleep(7000)
await A.$$eval('button',(bs)=>{const b=[...bs].find(x=>(x.textContent||'').includes('新建角色卡'));b&&b.click()})
await sleep(600)
// 用原生 setter 清空再输入（避免 Meta+A 失效）
await A.$$eval('.cm-name-input input',(es)=>{const el=es[0];const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(el,'');el.dispatchEvent(new Event('input',{bubbles:true}));el.focus()})
await A.keyboard.type('本地新卡Z')
await A.keyboard.press('Tab')
await sleep(2800)
console.log('A1 改名后含名:', (await names()).includes('本地新卡Z'))
await A.reload({waitUntil:'networkidle2',timeout:60000})
await sleep(6500)
const after=await names()
console.log('A2 刷新后卡仍在:', after.includes('本地新卡Z'), '| 列表:', JSON.stringify(after.slice(0,5)))
const back=(await (await fetch(API+'/characters')).json()).data||[]
console.log('A3 后端含此名:', back.some(c=>String(c.name).includes('本地新卡Z')))
await browser.close()
const all=(await (await fetch(API+'/characters')).json()).data||[]
for(const c of all.filter(c=>String(c.name).includes('本地新卡Z'))) await fetch(API+'/characters/'+c.id,{method:'DELETE'})
console.log('cleaned')
