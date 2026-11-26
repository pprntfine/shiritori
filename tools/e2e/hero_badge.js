// v550: トップ画面の「とー君ニュース」の横の足跡（#hero-badge）。メッセージが来たら出る（持ち主: 来ているのに付かない）。
//  ① トップを見ている時に届く ② 裏に回っている（トップ）時に届いて戻る ③ 閉じている間に届いて開く（読み込み直し）
// 使い方: bash tools/run_e2e.sh tools/e2e/hero_badge.js
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'f');const PS='https://zatsugaku-push.pprnt908.workers.dev';
async function dev(b,me,peer,host){const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC})=>{ if(!localStorage.getItem('mtp_id_v1')){ localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); }
   window.__vis='visible'; Object.defineProperty(document,'visibilityState',{get:()=>window.__vis,configurable:true}); Object.defineProperty(document,'hidden',{get:()=>window.__vis!=='visible',configurable:true}); },{me,peer,host,SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url();
  if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')});
  if(u===PS+'/push') return r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"sent":1}'});
  if(u.startsWith(PS))return r.continue(); return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); return {pg,ctx};}
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const ROLE=process.env.ROLE||'host';   // 受け取る B（持ち主）の役割
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',ROLE!=='host'), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',ROLE==='host');
 await A.pg.waitForTimeout(8000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; });
 await A.pg.evaluate(()=>{ __t.show('play'); __t.setTab('chat'); });
 const st=()=>B.pg.evaluate(()=>{ const h=document.getElementById('hero-badge'); const lob=document.getElementById('s-lobby'); return {badge:!!(h&&!h.hidden&&h.getBoundingClientRect().width>0),unread:__t.S.unread,phase:__t.S.phase,linked:!!__t.S.linked,lobby:!!(lob&&lob.classList.contains('on'))}; });
 const send=async(t)=>{ await A.pg.fill('#in-chat',t); await A.pg.click('#btn-chat-send'); };
 const res={};
 // B はトーク画面を一度開いてからトップへ（持ち主のいつもの形）
 await B.pg.evaluate(()=>{ __t.show('play'); __t.setTab('chat'); }); await B.pg.waitForTimeout(1500);
 await B.pg.evaluate(()=>{ __t.show('lobby'); __t.setTab('game'); }); await B.pg.waitForTimeout(500);
 await send('トップを見ている時'); await B.pg.waitForTimeout(8000); res.top=await st();
 // ② 裏に回る → トーク画面で既読にしてから、裏で受け取る
 await B.pg.evaluate(()=>{ __t.show('play'); __t.setTab('chat'); }); await B.pg.waitForTimeout(1500);
 await B.pg.evaluate(()=>{ window.__vis='hidden'; document.dispatchEvent(new Event('visibilitychange')); }); await B.pg.waitForTimeout(800);
 await send('裏の時'); await B.pg.waitForTimeout(8000);
 await B.pg.evaluate(()=>{ window.__vis='visible'; document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pageshow')); }); await B.pg.waitForTimeout(3000);
 res.bg=await st();
 // ③ 閉じている間に届いて開く
 await B.pg.evaluate(()=>{ __t.show('play'); __t.setTab('chat'); }); await B.pg.waitForTimeout(1500);
 await B.pg.close(); await send('閉じている時'); await A.pg.waitForTimeout(6000);
 B.pg=await B.ctx.newPage(); await B.pg.goto('https://zg.test/index.html'); await B.pg.waitForTimeout(12000);
 res.closed=await st();
 console.log(JSON.stringify(res));
 const ok=res.top.badge&&res.bg.badge&&res.closed.badge;
 console.log(ok?'OK: 足跡が付く':'NG: 足跡が付かない'); await b.close(); process.exit(ok?0:1);})();
