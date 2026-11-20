// v524: メッセージ1通で通知が何回出るか（持ち主: 1通に通知が複数、数分後に）。2台・中継所。
//  B（受け取る側）はアプリを裏に回したまま（Android はしばらく画面の中身が生きている）。
//  数える物: A が送る /push（＝B のスマホの通知、sw.js が出す） と、B の画面の中から出す通知（notifyIncoming）。
//  ① B が裏で生きている ② B が裏で止まっていて（凍結）数分後に動き出す
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'d');const PS='https://zatsugaku-push.pprnt908.workers.dev';
const pushes=[]; let BREF=null;
// 本物のスマホでは sw.js が通知を出して cache 'zg-count' の 'pt' に時刻を残す。ここでは /push を受けたら B にそれを書く（B が凍結中なら後で書く）
const ptPending=[]; async function ptWrite(){ if(!BREF) return; while(ptPending.length){ const t=ptPending[0]; try{ await BREF.pg.evaluate(async(t)=>{ const c=await caches.open('zg-count'),o=await c.match('pt'); const l=(o?await o.text():'').split(',').filter(x=>x); l.push(String(t)); await c.put('pt',new Response(l.join(','))); },t); ptPending.shift(); }catch(e){ return; } } }
async function dev(b,me,peer,host,count){const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC})=>{ if(!sessionStorage.getItem('i')){ sessionStorage.setItem('i','1'); localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); }
   window.__vis='visible'; Object.defineProperty(document,'visibilityState',{get:()=>window.__vis,configurable:true}); Object.defineProperty(document,'hidden',{get:()=>window.__vis!=='visible',configurable:true}); },{me,peer,host,SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url();
  if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')});
  if(count&&u===PS+'/push'){ try{ const j=JSON.parse(r.request().postData()||'{}'); if(/^zgm:/.test(j.msg||'')) pushes.push({at:Date.now()}); if(!process.env.NOPT){ ptPending.push(Date.now()); setTimeout(ptWrite,10); } }catch(e){} return r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"sent":1}'}); }
  if(u.startsWith(PS))return r.continue(); return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); return {pg,ctx};}
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 // 持ち主の形: 受け取る B＝ホスト（Android）、送る A＝ゲスト（iPhone）。ホストは app-live を送らないので、A は送った瞬間に通知を送る
 const RB=process.env.ROLE==='guest';   // ROLE=guest: 受け取る B がゲスト（相手が開いていると見えて通知が送られない形）→ 画面の通知が1回出ること
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',RB,true), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',!RB,false);
 BREF=B; await A.pg.waitForTimeout(8000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 // B の画面から出す通知を数える（通知の許可ありにする）
 await B.pg.evaluate(()=>{ window.__pn=[]; const F=function(t,o){ window.__pn.push({at:Date.now(),tag:o&&o.tag}); this.close=function(){}; }; F.permission='granted'; F.requestPermission=async()=>'granted'; window.Notification=F;
   const sr=__t.swReg||null; try{ if(navigator.serviceWorker){ navigator.serviceWorker.getRegistration().then(r=>{ if(r){ r.showNotification=async(t,o)=>{ window.__pn.push({at:Date.now(),tag:o&&o.tag,sw:1}); }; r.getNotifications=async()=>window.__pnLive||[]; } }); } }catch(e){} });
 const send=async(d,txt)=>{ await d.pg.fill('#in-chat',txt); await d.pg.click('#btn-chat-send'); };
 let all=true; const res={};
 const pnB=()=>B.pg.evaluate(()=>window.__pn.filter(x=>x.tag!=='mtp-chat-live').length);
 // ① B が裏に回る（中身は生きている）
 await B.pg.evaluate(()=>{ window.__vis='hidden'; document.dispatchEvent(new Event('visibilitychange')); });
 await A.pg.waitForTimeout(80000);   // 相手が今いる（70秒）の判定が切れるまで
 pushes.length=0; await B.pg.evaluate(()=>{ window.__pn.length=0; });
 await send(A,'うらで生きている時'); await A.pg.waitForTimeout(60000);
 res.alive={push:pushes.length,page:await pnB()};
 // ② B が凍結 → 送る → 3分後に動き出す
 const cdp=await B.ctx.newCDPSession(B.pg);
 pushes.length=0; await B.pg.evaluate(()=>{ window.__pn.length=0; });
 await cdp.send('Page.setWebLifecycleState',{state:'frozen'});
 await send(A,'こおっている時'); await A.pg.waitForTimeout(150000);
 const pushFrozen=pushes.length;
 await cdp.send('Page.setWebLifecycleState',{state:'active'}); await B.pg.waitForTimeout(30000);
 res.frozen={push:pushFrozen,pushAfter:pushes.length,page:await pnB()};
 console.log(JSON.stringify(res));
 const tot=x=>x.push+x.page;
 const ok=tot(res.alive)===1&&(res.frozen.pushAfter+res.frozen.page)===1;
 console.log(ok?'OK: 1通につき通知は1回':'NG: 1通に通知が複数');
 await b.close(); process.exit(ok?0:1);})();
