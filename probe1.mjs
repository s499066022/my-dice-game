import puppeteer from 'puppeteer-core'
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--no-sandbox']})
const A=await browser.newPage()
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
const errs=[]
A.on('pageerror',(e)=>errs.push(String(e).slice(0,150)))
await A.goto('http://localhost:5173/cards',{waitUntil:'networkidle2',timeout:60000})
await sleep(8000)
const items=await A.$$eval('.cm-card-item',e=>e.length)
console.log('卡片数:',items)
// 逐个点击测切换耗时
for(let i=0;i<items&&i<8;i++){
  const t0=Date.now()
  await A.$$eval('.cm-card-item',(es,idx)=>{es[idx]&&es[idx].click()},i)
  // 等 header name 变化
  let ok=false
  while(Date.now()-t0<8000){const nm=await A.$$eval('.cm-name-input input',e=>e[0]?.value).catch(()=>'');if(nm&&nm.includes('压测角色'+i)){ok=true;break}await sleep(50)}
  console.log(`点击 ${i} -> 切换耗时 ${Date.now()-t0}ms ${ok?'ok':'NO-RESPONSE'}`)
}
console.log('页面错误数:',errs.length, errs.slice(0,3))
await browser.close()
