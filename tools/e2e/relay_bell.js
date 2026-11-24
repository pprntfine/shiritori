// v540: メッセージを中継所に置く時、相手に通知を送る最初の1回だけ bell（相手の通知の とおりみち）を添える（中継所からも通知が出る）。
// 最初の通知が届いた後の送り直しには添えない（2回鳴らさない）。相手には1通だけ届く。中継所（wrangler dev の Worker）が bell 付きを受け付けて置く。
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'g');const PS='https://zatsugaku-push.pprnt908.workers.dev';
let lateUntil=0; let blockA=false;
const https=require('https');
function local(req){ return new Promise((ok,ng)=>{ const u=new URL(req.url()); const body=req.postDataBuffer();
 const h=Object.assign({},req.headers(),{host:u.host}); delete h['content-length'];
 const q=https.request({host:'127.0.0.1',port:443,path:u.pathname+u.search,method:req.method(),headers:h,rejectUnauthorized:false,servername:u.hostname},rs=>{ const c=[]; rs.on('data',d=>c.push(d)); rs.on('end',()=>ok({status:rs.statusCode,headers:rs.headers,body:Buffer.concat(c)})); });
 q.on('error',ng); if(body) q.write(body); q.end(); }); }
const CLOSED=!!process.env.CLOSED;
async function dev(b,me,peer,host,late){const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC})=>{ if(sessionStorage.getItem('i'))return; sessionStorage.setItem('i','1'); localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{me,peer,host,SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url();
  if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')});
  if(late&&(u.startsWith(PS+'/r/'))&&r.request().method()==='POST'&&Date.now()<lateUntil){
    // 中継所には届ける（相手は受け取れる）が、こちらへの返事は12秒遅らせる（アプリは10秒で打ち切る）
    // （Playwright の r.fetch は host-resolver-rules を通らないので、手元の中継所へ自分で送る）
    let res; try{ res=await local(r.request()); }catch(e){ return r.abort(); }
    await new Promise(x=>setTimeout(x,12000)); try{ return await r.fulfill(res); }catch(e){ return; } }
  if(u.startsWith(PS))return r.continue(); return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); return {pg};}
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',false,false), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',true,false);
 const errs=[]; for(const d of [A,B]) d.pg.on('pageerror',e=>{ if(!/ServiceWorker/.test(String(e))) errs.push(String(e)); });
 await A.pg.waitForTimeout(8000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 // 相手への通知（/push）は成功した形にする（本物では相手のスマホの とうろくがある）
 await A.pg.context().route(PS+'/push',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"sent":1}'}));
 const posts=[]; A.pg.context().on('request',r=>{ const u=r.url(); if(r.method()==='POST'&&(u.startsWith(PS+'/r/')||u.startsWith('https://ntfy.sh/gskr'))) posts.push(u.replace(PS,'PS')); });
 await A.pg.fill('#in-chat','中継所からも通知'); await A.pg.click('#btn-chat-send');
 let got=false; for(let i=0;i<40&&!got;i++){ await B.pg.waitForTimeout(500); got=await B.pg.evaluate(()=>__t.S.chat.filter(m=>m.text==='中継所からも通知').length===1); }
 await A.pg.waitForTimeout(3000);
 const first=posts.slice(); posts.length=0;
 // 送り直し（受領が無かった形にして）
 await A.pg.evaluate(()=>{ const m=__t.S.chat.find(m=>m.text==='中継所からも通知'); m.acked=false; m.peerAck=false; m.read=false; m.lastTry=0; m.tries=0; });
 await A.pg.evaluate(()=>{ __t.Net.resendEnv(__t.S.chat.find(m=>m.text==='中継所からも通知').env); });
 await A.pg.waitForTimeout(4000);
 const again=posts.slice();
 const bellTopic=await A.pg.evaluate(()=>window.__zgBellT||'');
 const n=await B.pg.evaluate(()=>__t.S.chat.filter(m=>m.text==='中継所からも通知').length);
 console.log('最初の送信:',JSON.stringify(first));
 console.log('送り直し:',JSON.stringify(again));
 console.log('相手に届いた数:',n,'・bell:',bellTopic.slice(0,9),'エラー',errs.length?errs:'なし');
 const ok=got&&n===1&&/^gskb-/.test(bellTopic)&&first.some(u=>u.includes('bell='+bellTopic))&&!first.some(u=>u.startsWith('https://ntfy.sh')&&u.includes('bell='))&&again.length>0&&!again.some(u=>u.includes('bell='))&&!errs.length;
 console.log(ok?'OK: 最初の1回だけ bell を添え、相手には1通だけ届く':'NG');
 await b.close(); process.exit(ok?0:1);})();
