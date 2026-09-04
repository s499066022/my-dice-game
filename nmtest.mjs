import puppeteer from 'puppeteer-core'
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--no-sandbox']})
const p=await browser.newPage()
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
let bodies=[]
p.on('request',async(r)=>{const u=r.url();if(u.includes('/blocks/combat')&&r.method()==='PATCH'){try{bodies.push(JSON.parse(r.postData()||'{}').data||{})}catch{}}})
await p.goto('http://localhost:5173/cards',{waitUntil:'domcontentloaded',timeout:60000})
await sleep(8000)
await p.$$eval('.cm-card-item',(es)=>{es[0]?.click()}); await sleep(600)
// 改名 -> 新名甲
await p.$$eval('.cm-name-input input',(es)=>{const el=es[0];const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(el,'');el.dispatchEvent(new Event('input',{bubbles:true}));el.focus()})
await p.keyboard.type('新名甲'); await p.keyboard.press('Tab')
await sleep(1500)
// 战斗页改 HP 当前=5
await p.$$eval('.cm-form-row',(rs)=>{const row=[...rs].find(r=>r.querySelector('label')?.textContent?.trim()==='当前');const inp=row?.querySelector('input');if(inp){inp.focus();inp.select();return true}return false})
await p.keyboard.type('5'); await p.keyboard.press('Tab')
await sleep(1800)
console.log('PATCH bodies:',bodies.map(b=>'name' in b?'含name!':'无name, keys='+Object.keys(b).join(',')).join(' | '))
const light=await (await fetch('http://localhost:12226/api/characters/light')).json()
const c=light.data.find(x=>x.id==='nm-a')
console.log('后端名字:',c.name, c.name==='新名甲'?'✅ 保持':'❌ 被改')
await browser.close()
