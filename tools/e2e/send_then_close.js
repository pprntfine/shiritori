// v537: 送る側（A＝ゲスト・iPhone）が送ってすぐアプリを閉じた（画面が止められた）時、相手（B＝ホスト）への通知が、A を次に開くまで遅れないか。
//  A が送る → 0.05秒後に A を凍結（iPhone で閉じた形）→ 20秒のうちに B への通知（/push の zgm）が出たか・メッセージが中継所に届いたか
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
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',false,true), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',true,false);
 BREF=B; await A.pg.waitForTimeout(8000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 await A.pg.fill('#in-chat','ならし'); await A.pg.click('#btn-chat-send'); await A.pg.waitForTimeout(5000);
 // B はアプリを閉じる
 await B.pg.close(); await A.pg.waitForTimeout(80000);
 const cdp=await A.ctx.newCDPSession(A.pg);
 pushes.length=0;
 const relayPosts=[]; const reqLog=[]; A.ctx.on('request',r=>{ if(r.method()==='POST'&&r.url().startsWith(PS+'/r/')) relayPosts.push(Date.now()); if(r.method()==='POST') reqLog.push({at:Date.now(),u:r.url().replace(PS,'PS').slice(0,40)}); });
 if(process.env.TIMING){ await A.pg.fill('#in-chat','時間を測る'); const tt=Date.now(); await A.pg.click('#btn-chat-send'); if(process.env.TIMING==='hide') await A.pg.evaluate(()=>{ window.__vis='hidden'; document.dispatchEvent(new Event('visibilitychange')); if(!process.env.NOPH) window.dispatchEvent(new Event('pagehide')); }); if(process.env.TIMING==='vis') await A.pg.evaluate(()=>{ window.__vis='hidden'; document.dispatchEvent(new Event('visibilitychange')); }); await A.pg.waitForTimeout(3000); console.log('状態:',JSON.stringify(await A.pg.evaluate(()=>{ const m=__t.S.chat.find(m=>m.text==='時間を測る'); return {ready:__t.privateReady(),phase:__t.S.phase,outbox:__t.S.outbox.length,inflight:(__t.S.inflight||[]).length,flushing:__t.S.flushing,sent:m&&m.sent,n:m&&m.n,topic:!!__t.Net.topic,key:!!__t.Net.key,cool:__t.Net.coolUntil>Date.now()}; }))); await A.pg.waitForTimeout(3000); console.log('送信ボタンからの時間:',JSON.stringify(reqLog.filter(x=>x.at>=tt).map(x=>({ms:x.at-tt,u:x.u})))); await b.close(); process.exit(0); }
 await A.pg.fill('#in-chat','送ってすぐ閉じる');
 const t0=Date.now();
 await A.pg.click('#btn-chat-send');
 await A.pg.evaluate(()=>{ window.__vis='hidden'; document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide')); });
 await new Promise(r=>setTimeout(r,+(process.env.WAIT||50)));
 await cdp.send('Page.setWebLifecycleState',{state:'frozen'});
 await new Promise(r=>setTimeout(r,20000));
 const p1=pushes.length, rp1=relayPosts.length;
 console.log('閉じてから20秒の間: 相手への通知',p1,'回・中継所への送信',rp1,'回');
 await cdp.send('Page.setWebLifecycleState',{state:'active'}); await A.pg.evaluate(()=>{ window.__vis='visible'; document.dispatchEvent(new Event('visibilitychange')); });
 await A.pg.waitForTimeout(15000);
 console.log('次に開いた後: 相手への通知',pushes.length,'回');
 const ok=p1>=1;
 console.log(ok?'OK: 送ってすぐ閉じても通知はすぐ出る':'NG: 閉じると通知が次に開くまで出ない');
 await b.close(); process.exit(ok?0:1);})();
