// v493: 相手が閉じている間、受領待ちの送り直しが続いても、メッセージの通知（/push の zgm:）は1通につき1回だけ。
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
 await send(A,'はじめ'); await A.pg.waitForTimeout(3000);
 await B.pg.close();                       // 相手がアプリを閉じる
 await A.pg.waitForTimeout(75000);         // 「相手が今いる」の判定（70秒）が切れるまで待つ
 pushes.length=0;
 await send(A,'とじている間1'); await A.pg.waitForTimeout(800); await send(A,'とじている間2');
 await A.pg.waitForTimeout(120000);        // 送り直しが何回も起きる時間
 const st=await A.pg.evaluate(()=>({tries:(__t.S.outbox||[]).map(x=>x.tries||0),diag:window.__sendDiag||null}));
 const r={pushes:pushes.length,detail:pushes.map(p=>p.tail),outboxTries:st.tries,lastSend:st.diag};
 console.log(JSON.stringify(r));
 const ok=pushes.length>=1&&pushes.length<=2&&st.tries.some(t=>t>=2);
 console.log(ok?'OK: 送り直しは続くが、通知は1通につき1回まで':'NG');
 await b.close(); process.exit(ok?0:1);})();
