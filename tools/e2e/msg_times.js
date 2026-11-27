// v553: ホスト（Android）だけが見られる「メッセージの時刻」。① あなたが送った時刻と、相手（iPhone）のスマホで通知が鳴った時刻（sw.js が残す 'rg' → 相手の画面が 'rang' で知らせる）
//  ② 相手が送った時刻。③ ゲスト側には記録も表示も無い。アクセス履歴（タイトル5回）に出る。2台・中継所。
// v554: 2つの列（左＝この端末・右＝相手）。列の名前は端末の種類（相手の種類は app-live の os）。
// 使い方: bash tools/run_e2e.sh tools/e2e/msg_times.js
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'b');const PS='https://zatsugaku-push.pprnt908.workers.dev';
const pushes=[];
const UA={A:'Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36',B:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'};
async function dev(b,me,peer,host,count){const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,userAgent:host?UA.A:UA.B});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC})=>{ if(!localStorage.getItem('mtp_id_v1')){ localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); }
   window.__vis='visible'; Object.defineProperty(document,'visibilityState',{get:()=>window.__vis,configurable:true}); Object.defineProperty(document,'hidden',{get:()=>window.__vis!=='visible',configurable:true}); },{me,peer,host,SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url();
  if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')});
  if(u===PS+'/push'){ if(count){ try{ const j=JSON.parse(r.request().postData()||'{}'); if(/^zgm:/.test(j.msg||'')) pushes.push(String(j.msg).replace(/^zgm:\d+:/,'')); }catch(e){} } return r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"sent":1}'}); }
  if(u.startsWith(PS))return r.continue(); return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); return {pg,ctx};}
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true,true), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false,false);
 await A.pg.waitForTimeout(8000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 // B（iPhone）はトップ・裏
 await B.pg.evaluate(()=>{ __t.show('lobby'); __t.setTab('game'); window.__vis='hidden'; document.dispatchEvent(new Event('visibilitychange')); });
 await A.pg.waitForTimeout(3000);
 pushes.length=0; const t0=await A.pg.evaluate(()=>Date.now());
 await A.pg.fill('#in-chat','鳴った時刻のテスト'); await A.pg.click('#btn-chat-send');
 for(let i=0;i<40&&!pushes.length;i++) await A.pg.waitForTimeout(250);
 const body=pushes[0]||''; await B.pg.waitForTimeout(4000);
 // B の sw.js が通知を出した（偽物: 'rg' に暗号文の末尾と時刻を書く）
 const rangAt=t0+1200;
 await B.pg.evaluate(async({z,at})=>{ const c=await caches.open('zg-count'); await c.put('rg',new Response(z.slice(-32)+'|'+at)); },{z:body,at:rangAt});
 // B がアプリを開く → 知らせる
 await B.pg.evaluate(()=>{ window.__vis='visible'; document.dispatchEvent(new Event('visibilitychange')); });
 await B.pg.evaluate(()=>__t.rangFlush()); await A.pg.waitForTimeout(5000);
 // B から送る
 await B.pg.evaluate(()=>{ __t.show('play'); __t.setTab('chat'); }); await B.pg.fill('#in-chat','iPhoneから'); await B.pg.click('#btn-chat-send'); await A.pg.waitForTimeout(6000);
 const la=await A.pg.evaluate(()=>__t.mtLoad()); const lb=await B.pg.evaluate(()=>({mt:localStorage.getItem('zg_msg_times'),box:(()=>{ const br=document.querySelector('.brand'); for(let i=0;i<5;i++) br.click(); return !!document.getElementById('mem-mt-list'); })()}));
 const out=la.find(e=>e.d==='out'), inn=la.find(e=>e.d==='in');
 // A のアクセス履歴を開いて画像
 await A.pg.evaluate(()=>{ const br=document.querySelector('.brand'); for(let i=0;i<5;i++) br.click(); }); await A.pg.waitForTimeout(800);
 await A.pg.evaluate(()=>{ const m=document.getElementById('mem-mt-list'); if(m) m.scrollIntoView(); }); await A.pg.waitForTimeout(300);
 await A.pg.screenshot({path:process.env.SHOT||'/tmp/msg_times.png'});
 const text=await A.pg.evaluate(()=>{ const m=document.getElementById('mem-mt-list'); return m?m.innerText:''; });
 const res={out,inn,guestStored:lb.mt,guestBox:lb.box,text:text.slice(0,300)};
 console.log(JSON.stringify(res));
 const rows=await A.pg.evaluate(()=>document.querySelectorAll('#mem-mt-list .mt-row').length);
 const ok=!!body&&out&&out.rg===rangAt&&!!inn&&inn.rv&&!lb.mt&&!lb.box&&/鳴った/.test(text)&&rows===2&&/Android（あなた）/.test(text)&&/iPhone（相手）/.test(text);
 console.log(ok?'OK: ホストだけに送信時刻と鳴った時刻が出る':'NG'); await b.close(); process.exit(ok?0:1);})();
