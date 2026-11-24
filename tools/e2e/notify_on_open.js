// v538: 持ち主（B＝ホスト）がアプリを閉じている間に1通届き、スマホの通知（sw.js）が出る → あとで持ち主がアプリを開く → もう一度通知が出ないこと。
//  開くまでの時間 AGE（分、既定 20）: v537 までは15分を過ぎると、画面がもう一度通知を出していた。
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
 const AGE=+(process.env.AGE||20);
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',false,true), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',true,false);
 BREF=null; await A.pg.waitForTimeout(8000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 await A.pg.fill('#in-chat','ならし'); await A.pg.click('#btn-chat-send'); await A.pg.waitForTimeout(5000);
 const ctxB=B.ctx; await B.pg.close(); await A.pg.waitForTimeout(3000);
 pushes.length=0;
 await A.pg.fill('#in-chat','閉じている間の1通'); await A.pg.click('#btn-chat-send'); await A.pg.waitForTimeout(8000);
 console.log('スマホの通知（相手が送った /push）:',pushes.length,'回');
 // 持ち主が AGE 分後にアプリを開く（sw.js が通知を出した時刻 pt は AGE 分前）。通知の数を数える
 const ptAt=Date.now()-AGE*60000;
 await ctxB.addInitScript((ptAt)=>{ window.__pn=[]; const F=function(t,o){ window.__pn.push({t:Date.now(),tag:o&&o.tag}); this.close=function(){}; }; F.permission='granted'; F.requestPermission=async()=>'granted'; window.Notification=F;
   try{ caches.open('zg-count').then(c=>c.put('pt',new Response(String(ptAt)))); }catch(e){} },ptAt);
 const pg=await ctxB.newPage(); await pg.goto('https://zg.test/index.html');
 await pg.evaluate(()=>{ try{ navigator.serviceWorker&&navigator.serviceWorker.getRegistration().then(r=>{ if(r){ r.showNotification=async(t,o)=>{ window.__pn.push({t:Date.now(),tag:o&&o.tag,sw:1}); }; } }); }catch(e){} });
 await pg.waitForTimeout(25000);
 const got=await pg.evaluate(()=>__t.S.chat.some(m=>m.text==='閉じている間の1通'));
 const pn=await pg.evaluate(()=>window.__pn.filter(x=>x.tag!=='mtp-chat-live'));
 console.log('開いた後（'+AGE+'分後）: 届いた',got,'・画面が出した通知',pn.length,'回',JSON.stringify(pn));
 const ok=got&&pn.length===0;
 console.log(ok?'OK: 開いた時にもう一度通知は出ない':'NG: 開いた時にもう一度通知が出た');
 await b.close(); process.exit(ok?0:1);})();
