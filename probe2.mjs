import puppeteer from 'puppeteer-core'
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--no-sandbox']})
const A=await browser.newPage()
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
const errs=[]
A.on('pageerror',(e)=>errs.push(String(e).slice(0,150)))
A.on('response',(r)=>{const u=r.url();if(u.includes('/blocks/')){} })
const reqs=[]
A.on('request',(r)=>{const u=r.url();if(u.includes('/api/characters/'))reqs.push((r.method()+' '+u.replace('http://localhost:5173','').slice(0,70)))})
await A.goto('http://localhost:5173/cards',{waitUntil:'networkidle2',timeout:60000})
await sleep(8000)
const setTab=async(txt)=>{await A.$$eval('.cm-tabs .el-tabs__item',(es,t)=>{const x=[...es].find(e=>e.textContent.includes(t));x&&x.click()},txt);await sleep(1200)}
for(const tab of ['技能','法术']){
  await setTab(tab)
  reqs.length=0
  for(let i=0;i<4;i++){
    const t0=Date.now()
    await A.$$eval('.cm-card-item',(es,idx)=>{es[idx]&&es[idx].click()},i)
    let ok=false
    while(Date.now()-t0<8000){const nm=await A.$$eval('.cm-name-input input',e=>e[0]?.value).catch(()=>'');if(nm&&nm.includes('压测角色'+i)){ok=true;break}await sleep(60)}
    console.log(`[${tab}] 切到 ${i}: ${Date.now()-t0}ms ${ok?'ok':'NO-RESPONSE'}`)
  }
  console.log('  -- 期间 /api 请求数:',reqs.length, reqs.slice(0,6).join(' | '))
}
console.log('errs:',errs.length,errs.slice(0,3))
await browser.close()
