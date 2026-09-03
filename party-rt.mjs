import puppeteer from 'puppeteer-core'
const API='http://localhost:12226/api'
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
async function waitFor(fn,d,ms=30000){const t0=Date.now();while(Date.now()-t0<ms){try{if(await fn())return true}catch{}await sleep(300)}throw new Error('超时 '+d)}
const before=(await (await fetch(API+'/parties')).json()).data||[]
console.log('后端团基数:',before.map(p=>p.name).join(','))
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage']})
let pass=0,fail=0;const ok=(c,l)=>{if(c){pass++;console.log('  ✅',l)}else{fail++;console.log('  ❌',l)}}
try{
  const ca=await browser.createBrowserContext(), cb=await browser.createBrowserContext()
  const A=await ca.newPage(), B=await cb.newPage()
  for(const p of [A,B]) p.on('pageerror',(e)=>console.log('[err]',String(e).slice(0,140)))
  await A.goto('http://localhost:5173/map',{waitUntil:'networkidle2',timeout:60000})
  await new Promise(r=>setTimeout(r,4000))
  await B.goto('http://localhost:5173/party',{waitUntil:'networkidle2',timeout:60000})
  await waitFor(async()=>(await B.$$eval('button',e=>e.length))>0,'B 团页就绪')
  // B 快速连点 6 次“新建团” -> 应只建 1 个
  for(let i=0;i<6;i++){await B.$$eval('button',(bs)=>{const b=[...bs].find(x=>(x.textContent||'').includes('新建团'));if(b)b.click()}).catch(()=>{});await sleep(40)}
  await sleep(2500)
  const mid=(await (await fetch(API+'/parties')).json()).data||[]
  ok(mid.length===before.length+1,`连点 6 次只新增 1 个团 (${before.length} -> ${mid.length})`)
  // A（地图页）实时看到新团（presence-parties，无需 20s 轮询等太久）
  const newName=(mid.find(p=>!before.some(b=>b.id===p.id))||{}).name||''
  await A.click('.cs-row .el-select__wrapper').catch(()=>{})
  const seen=await (async()=>{for(let i=0;i<30;i++){const t=await A.evaluate(()=>document.body.textContent||'');if(t.includes(newName))return true;await sleep(500)}return false})()
  ok(seen,'A 地图页（不刷新）实时看到新团: '+newName)
  const lgA=(await A.$$eval('.wslog-list',e=>e.map(x=>x.textContent).join('|')))
  ok(lgA.includes('.PartiesChanged'),'A 日志捕获收包 .PartiesChanged')
  ok(/presence-parties/.test(lgA),'A 已订阅 presence-parties 频道')
  // B 改名 -> A 实时跟随（同一频道）
  const nm=await B.$$eval('.pm-name-input input,.party-manager .pm-party-name input,.pm-list input,.party-manager input',e=>e.length).catch(()=>0)
  // 团页左侧当前团名输入框：尝试点选当前团列表项后找到输入框
  await B.$$eval('input',(es)=>{const inp=[...es].find(x=>x.value&&(x.value.includes('团')||/^团 \d+$/.test(x.value)));if(inp){inp.focus();inp.select();return true}return false}).catch(()=>{})
  await B.keyboard.down('Meta');await B.keyboard.press('A');await B.keyboard.up('Meta')
  await B.keyboard.type('实时团R1');await B.keyboard.press('Tab')
  await sleep(2000)
  const seen2=await (async()=>{for(let i=0;i<20;i++){const t=await A.evaluate(()=>document.body.textContent||'');if(t.includes('实时团R1'))return true;await sleep(400)}return false})()
  ok(seen2,'改名后 A 实时看到新名 实时团R1')
  console.log(`\n=== 结果: ${pass} 通过, ${fail} 失败 ===`)
  // 还原后端团（保留基数）
  await fetch(API+'/parties/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:before})})
}finally{await browser.close()}
process.exit(fail?1:0)
