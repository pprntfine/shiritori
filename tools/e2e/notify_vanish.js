// v551: 「Android へのメッセージの通知が一瞬点いて消える」（持ち主）。
//  持ち主（B・ホスト・Android）はアプリを裏に回している。Chrome の電池を「制限なし」にしたので、裏でも画面の中身が生きている。
//  sw.js が通知（data.zgm＝暗号文）を出す → 画面の drainInbox が取り込み、通知を閉じていた（1秒ほどで消える）。
//  ここでは sw.js の通知を偽物で置く（試験では sw.js が動かないため）。① 裏の時は閉じない ② トーク画面を開いたら閉じる
// 使い方: bash tools/run_e2e.sh tools/e2e/notify_vanish.js
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'a');const PS='https://zatsugaku-push.pprnt908.workers.dev';
const pushes=[]; let delayRelay=0;
async function dev(b,me,peer,host,count){const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC})=>{ if(!localStorage.getItem('mtp_id_v1')){ localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); }
   window.__vis='visible'; Object.defineProperty(document,'visibilityState',{get:()=>window.__vis,configurable:true}); Object.defineProperty(document,'hidden',{get:()=>window.__vis!=='visible',configurable:true});
   window.__fakeNs=[]; window.__closed=0;
   try{ ServiceWorkerRegistration.prototype.getNotifications=async function(o){ window.__gn=(window.__gn||0)+1; return window.__fakeNs.filter(n=>!n.gone&&(!o||!o.tag||n.tag===o.tag)); }; }catch(e){}
   try{ const sw=navigator.serviceWorker; const orig=sw.getRegistration.bind(sw); sw.getRegistration=async()=>({ getNotifications:async(o)=>(window.__gn=(window.__gn||0)+1,window.__fakeNs).filter(n=>!n.gone&&(!o||!o.tag||n.tag===o.tag)), showNotification:async()=>{}, pushManager:null }); }catch(e){} },{me,peer,host,SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url();
  if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')});
  if(u===PS+'/push'){ if(count){ try{ const j=JSON.parse(r.request().postData()||'{}'); if(/^zgm:/.test(j.msg||'')) pushes.push(String(j.msg).replace(/^zgm:\d+:/,'')); }catch(e){} } return r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"sent":1}'}); }
  if(count&&delayRelay&&u.startsWith(PS+'/r/')&&r.request().method()==='POST'){ await new Promise(z=>setTimeout(z,delayRelay)); }   // 通知（push）を先に届ける
  if(u.startsWith(PS))return r.continue(); return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); return {pg,ctx};}
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',false,true), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',true,false);
 await A.pg.waitForTimeout(8000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; });
 await A.pg.evaluate(()=>{ __t.show('play'); __t.setTab('chat'); });
 // B は裏に回る（トップ）
 await B.pg.evaluate(()=>{ __t.show('lobby'); __t.setTab('game'); window.__vis='hidden'; document.dispatchEvent(new Event('visibilitychange')); });
 await A.pg.waitForTimeout(80000);   // A から見て B が「見ていない」になるまで
 pushes.length=0; delayRelay=5000; await A.pg.fill('#in-chat','通知が消えないか'); await A.pg.click('#btn-chat-send');
 for(let i=0;i<40&&!pushes.length;i++) await A.pg.waitForTimeout(250);
 const body=pushes[0]||'';
 // sw.js が出す通知（偽物）を B に置く
 await B.pg.evaluate((z)=>{ window.__fakeNs.push({tag:'zgs-'+z.slice(-32),data:{zgm:z},close(){ this.gone=true; window.__closed++; }}); },body);
 const dbg=await B.pg.evaluate(async(z)=>{ const had=__t.S.chat.some(c=>c.text==='通知が消えないか'); return {had}; },body);

 delayRelay=0;
 await B.pg.waitForTimeout(8000);
 const r1=await B.pg.evaluate(()=>({gn:window.__gn,pr:__t.privateReady(),loaded:__t.S.chatLoaded,closed:window.__closed,got:__t.S.chat.some(c=>c.text==='通知が消えないか')}));
 // B がトーク画面を開く
 await B.pg.evaluate(()=>{ window.__vis='visible'; document.dispatchEvent(new Event('visibilitychange')); __t.show('play'); __t.setTab('chat'); });
 await B.pg.waitForTimeout(5000);
 const r2=await B.pg.evaluate(()=>({closed:window.__closed}));

 const res={push:!!body,bgClosed:r1.closed,gotInBg:r1.got,afterOpenClosed:r2.closed};
 console.log(JSON.stringify(res));
 const ok=res.push&&res.gotInBg&&res.bgClosed===0&&res.afterOpenClosed===1;
 console.log(ok?'OK: 裏の時は通知が残り、トークを開いたら消える':'NG: 通知がすぐ消える（または開いても残る）'); await b.close(); process.exit(ok?0:1);})();
