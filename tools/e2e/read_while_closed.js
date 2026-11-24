// v539: 送った側（A＝持ち主）がアプリを閉じている間に、相手（B）が読む。B は即時路（MQTT）が使える状態（既読がそこだけで送られていた）。
// A があとで開いた時に「既読」が付く。v538 までは既読が中継所に残らず、A が開いても既読が付かなかった（相手の「消して」の合図だけ届いて消えていた）。
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
 await A.pg.fill('#in-chat','閉じている間に読まれる'); await A.pg.click('#btn-chat-send');
 let got=false; for(let i=0;i<40&&!got;i++){ await B.pg.waitForTimeout(500); got=await B.pg.evaluate(()=>__t.S.chat.some(m=>m.text==='閉じている間に読まれる')); }
 await A.pg.waitForTimeout(4000);
 // A はアプリを閉じる
 const ctxA=A.pg.context(); await A.pg.close(); await B.pg.waitForTimeout(2000);
 // B は即時路（MQTT）が使える状態にする（本物のスマホと同じ。ここでは公開 MQTT に出られないので、送れた扱いにする）
 await B.pg.evaluate(()=>{ const F=__t.Fast; F.pub=function(){ return true; }; Object.defineProperty(F,'open',{get:()=>true,set:()=>{},configurable:true}); Object.defineProperty(__t.FastH,'subOk',{get:()=>true,set:()=>{},configurable:true}); });
 console.log('B の即時路:',await B.pg.evaluate(()=>({open:__t.Fast.open,subOk:__t.FastH.subOk})));
 // B が読む（トーク画面を開く）→ 20秒（既読の送り直しも何回か）
 await B.pg.evaluate(()=>{ __t.show('play'); __t.setTab('chat'); });
 await B.pg.waitForTimeout(20000);
 // B は閉じる。A を開く
 await B.pg.close();
 const pg=await ctxA.newPage(); await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(6000);
 await pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 let rd=false; for(let i=0;i<30&&!rd;i++){ await pg.waitForTimeout(500); rd=await pg.evaluate(()=>{ const m=__t.S.chat.find(m=>m.text==='閉じている間に読まれる'); return !!(m&&m.read); }); }
 console.log('B が受け取った:',got,'・A が開いた後に既読が付いた:',rd,'エラー',errs.length?errs:'なし');
 const ok=got&&rd&&!errs.length;
 console.log(ok?'OK: 閉じている間に読まれても、開いたら既読が付く':'NG: 開いても既読が付かない');
 await b.close(); process.exit(ok?0:1);})();
