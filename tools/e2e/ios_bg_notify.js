// v548: 「iPhone に通知が行っていない」（持ち主）。持ち主＝ホスト（Android）が送る、相手＝ゲスト（iPhone）。
//  iPhone はアプリを裏に回した直後もしばらく動いていて、メッセージを受け取り「受け取った（ack）」を返す。その後すぐ止められる（凍結）。
//  ホストは相手が「今いる」と見て通知を送らず、受領が来たので後からも送らない。iPhone の画面の通知は5秒待ちの間に止められて出ない → 通知0回。
//  数える物: A（ホスト）が送る /push（＝iPhone の sw.js の通知）と、B の画面から出す通知。1回以上なら OK。
// 使い方: bash tools/run_e2e.sh tools/e2e/ios_bg_notify.js
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'e');const PS='https://zatsugaku-push.pprnt908.workers.dev';
const pushes=[];
async function dev(b,me,peer,host,count){const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC})=>{ if(!sessionStorage.getItem('i')){ sessionStorage.setItem('i','1'); localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); }
   window.__vis='visible'; Object.defineProperty(document,'visibilityState',{get:()=>window.__vis,configurable:true}); Object.defineProperty(document,'hidden',{get:()=>window.__vis!=='visible',configurable:true}); },{me,peer,host,SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url();
  if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')});
  if(count&&u===PS+'/push'){ try{ const j=JSON.parse(r.request().postData()||'{}'); if(/^zgm:/.test(j.msg||'')) pushes.push({at:Date.now(),msg:String(j.msg).slice(0,20)}); }catch(e){} return r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"sent":1,"send":1}'}); }
  if(u.startsWith(PS))return r.continue(); return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); return {pg,ctx};}
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true,true), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false,false);
 await A.pg.waitForTimeout(8000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 await B.pg.evaluate(()=>{ window.__pn=[]; const F=function(t,o){ window.__pn.push({at:Date.now(),tag:o&&o.tag}); this.close=function(){}; }; F.permission='granted'; F.requestPermission=async()=>'granted'; window.Notification=F;
   try{ navigator.serviceWorker.getRegistration().then(r=>{ if(r){ r.showNotification=async(t,o)=>{ window.__pn.push({at:Date.now(),tag:o&&o.tag,sw:1}); }; r.getNotifications=async()=>[]; } }); }catch(e){} });
 const send=async(d,txt)=>{ await d.pg.fill('#in-chat',txt); await d.pg.click('#btn-chat-send'); };
 // B（iPhone）が見ている → A に「今いる」が届くまで待つ
 await send(B,'こんにちは'); await A.pg.waitForTimeout(30000);
 const live=await A.pg.evaluate(()=>Date.now()-(+(window.__zgsPeerLive||0)||0));
 // B がホームに戻る（裏に回る）。2秒後に A が送る。B は受け取って受領を返した直後に止められる
 await B.pg.evaluate(()=>{ window.__vis='hidden'; document.dispatchEvent(new Event('visibilitychange')); });
 await A.pg.waitForTimeout(2000);
 pushes.length=0; await B.pg.evaluate(()=>{ window.__pn.length=0; });
 const cdp=await B.ctx.newCDPSession(B.pg);
 await send(A,'裏に回った直後');
 // B が受け取るのを待ってから凍結
 for(let i=0;i<40;i++){ const got=await B.pg.evaluate(()=>__t.S.chat.some(c=>c.text==='裏に回った直後')); if(got) break; await B.pg.waitForTimeout(250); }
 await B.pg.waitForTimeout(1200); const pnBefore=await B.pg.evaluate(()=>window.__pn.length);
 await cdp.send('Page.setWebLifecycleState',{state:'frozen'});
 await A.pg.waitForTimeout(20000);
 const acked=await A.pg.evaluate(()=>__t.S.chat.some(c=>c.text==='裏に回った直後'&&(c.peerAck||c.acked)));
 const res={peerLiveAgoMs:live,acked,push:pushes.length,pushMsgs:pushes.map(p=>p.msg),pageBeforeFreeze:pnBefore};
 console.log(JSON.stringify(res));
 const ok=(res.push+res.pageBeforeFreeze)>=1;
 console.log(ok?'OK: iPhone に通知が出る':'NG: 通知が0回（iPhone に届かない）');
 await b.close(); process.exit(ok?0:1);})();
