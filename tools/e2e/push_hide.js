// v506: 相手が閉じた直後に送り、すぐ送る側の画面を消しても、相手に通知が出る（iPhone はアプリを止める）。
// /push は数えるだけで「届いた」と返す（本物のスマホの通知はここでは出せない）。
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'e');const PS='https://zatsugaku-push.pprnt908.workers.dev';
const pushes=[];
async function dev(b,me,peer,host,count){const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC})=>{ if(sessionStorage.getItem('i'))return; sessionStorage.setItem('i','1'); localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{me,peer,host,SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url();
  if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')});
  if(count&&u===PS+'/push'){ try{ const j=JSON.parse(r.request().postData()||'{}'); if(/^zgm:/.test(j.msg||'')) pushes.push({at:Date.now(),tail:String(j.msg).slice(-12)}); }catch(e){} return r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"sent":1}'}); }
  if(u.startsWith(PS))return r.continue(); return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); return {pg};}
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true,true), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false,false);
 await A.pg.waitForTimeout(8000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 const send=async(d,txt)=>{ await d.pg.fill('#in-chat',txt); await d.pg.click('#btn-chat-send'); };
 pushes.length=0;
 await send(B,'あいてから'); await A.pg.waitForTimeout(3000);
 await send(A,'ひらいている時'); await A.pg.waitForTimeout(15000);
 const p1=pushes.length; console.log('相手が開いている時の通知',p1);
 await send(B,'とじる前'); await A.pg.waitForTimeout(2000);
 await B.pg.close();                       // 相手がアプリを閉じた直後（送る側にはまだ開いていると見える）
 pushes.length=0; const t0=Date.now();
 await send(A,'とじた直後');
 await A.pg.waitForTimeout(500);
 // 送った 0.5秒後に、送る側が画面を消す（iPhone は このあと アプリを とめる）
 await A.pg.evaluate(()=>{ Object.defineProperty(document,'hidden',{get:()=>true,configurable:true}); Object.defineProperty(document,'visibilityState',{get:()=>'hidden',configurable:true}); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pagehide')); });
 const cdp=await A.pg.context().newCDPSession(A.pg);
 await cdp.send('Page.enable'); await cdp.send('Page.setWebLifecycleState',{state:'frozen'});
 await new Promise(r=>setTimeout(r,25000));
 console.log('送ってから0.5秒後に画面を消した時、25秒間の通知の数:',pushes.length, pushes.length?('（'+Math.round((pushes[0].at-t0)/1000)+'秒後）'):'');
 const ok=pushes.length>=1;
 console.log(ok?'OK: 画面を消しても通知は出た':'NG: 通知が出なかった');
 await b.close(); process.exit(ok?0:1);})();
