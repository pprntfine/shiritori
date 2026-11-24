// v540: ホスト（A）がアプリを閉じている間に、相手（B＝ゲスト）がトーク画面を開いて読む。B は即時路（MQTT）が使える状態。
// A があとで開くと、アクセス履歴に「トーク画面を開きました」と既読の印が残る（v539 までは MQTT で流れて消え、記録が抜けていた）。
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
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true,false), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false,false);
 const errs=[]; for(const d of [A,B]) d.pg.on('pageerror',e=>{ if(!/ServiceWorker/.test(String(e))) errs.push(String(e)); });
 await A.pg.waitForTimeout(8000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 await B.pg.evaluate(()=>{ __t.show('home'); });
 await A.pg.fill('#in-chat','記録のテスト'); await A.pg.click('#btn-chat-send');
 let got=false; for(let i=0;i<40&&!got;i++){ await B.pg.waitForTimeout(500); got=await B.pg.evaluate(()=>__t.S.chat.some(m=>m.text==='記録のテスト')); }
 await A.pg.waitForTimeout(4000);
 const ctxA=A.pg.context(); await A.pg.close(); await B.pg.waitForTimeout(3000);
 await B.pg.evaluate(()=>{ const F=__t.Fast; F.pub=function(){ return true; }; Object.defineProperty(F,'open',{get:()=>true,set:()=>{},configurable:true}); Object.defineProperty(__t.FastH,'subOk',{get:()=>true,set:()=>{},configurable:true}); });
 // B がトーク画面を開く（本物の「開いた」合図と同じく、画面をさわって開いた形）
 await B.pg.evaluate(()=>{ window.__co=[]; const N=__t.Net,o=N.send.bind(N); N.send=function(obj,cb){ if(obj&&obj.t==='chat-open') window.__co.push({r:obj.r,fg:obj.fg,g:obj.g}); return o(obj,cb); }; });
 const tOpen=Date.now();
 await B.pg.mouse.click(10,10);
 await B.pg.evaluate(()=>{ __t.show('play'); __t.setTab('chat'); });
 await B.pg.waitForTimeout(15000);
 console.log('B が送った開いた合図:',JSON.stringify(await B.pg.evaluate(()=>window.__co)));
 await B.pg.close();
 const pg=await ctxA.newPage(); await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(9000);
 const log=await pg.evaluate((tOpen)=>{ const l=JSON.parse(localStorage.getItem('zg_peer_log')||'[]'); return l.filter(e=>e&&e.t>=tOpen-5000).map(e=>({k:e.k,r:e.r||'',p:e.p||''})); },tOpen);
 const rd=await pg.evaluate(()=>{ const m=__t.S.chat.find(m=>m.text==='記録のテスト'); return !!(m&&m.read); });
 console.log('A が開いた後の記録:',JSON.stringify(log),'・既読:',rd,'エラー',errs.length?errs:'なし');
 const ok=got&&rd&&log.some(e=>e.r==='play'||e.r==='launch'||e.r==='resume')&&!errs.length;
 console.log(ok?'OK: 閉じている間に相手が開いて読んでも、記録と既読が残る':'NG: 記録が抜けた');
 await b.close(); process.exit(ok?0:1);})();
