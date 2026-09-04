import puppeteer from 'puppeteer-core'
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--no-sandbox']})
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
const headName=async(p)=>{const v=await p.$$eval('.cm-name-input input',e=>e[0]?.value??'').catch(()=>'(err)');return v}
for(const waitMs of [300, 900, 2000]){
  try{
    const ctx=await browser.createBrowserContext(); const p=await ctx.newPage()
    p.on('pageerror',(e)=>console.log('[err]',String(e).slice(0,140)))
    await p.goto('http://localhost:5173/cards',{waitUntil:'domcontentloaded',timeout:90000})
    await sleep(8000)
    await p.$$eval('.cm-card-item',(es)=>{es[0]?.click()}); await sleep(600)
    await p.$$eval('.cm-name-input input',(es)=>{const el=es[0];const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(el,'');el.dispatchEvent(new Event('input',{bubbles:true}));el.focus()})
    await p.keyboard.type('新名'+waitMs); await p.keyboard.press('Tab')
    await sleep(waitMs)
    await p.goto('http://localhost:5173/party',{waitUntil:'domcontentloaded',timeout:90000}); await sleep(4500)
    await p.goto('http://localhost:5173/cards',{waitUntil:'domcontentloaded',timeout:90000}); await sleep(9000)
    await p.$$eval('.cm-card-item',(es)=>{es[0]?.click()}); await sleep(700)
    const nm=await headName(p)
    console.log(`等${waitMs}ms: header=${JSON.stringify(nm)} ${nm===('新名'+waitMs)?'✅':'❌ 回退'}`)
    await ctx.close()
  }catch(e){console.log('等'+waitMs+' 异常:',String(e).slice(0,200))}
}
await browser.close()
