// v561: 2MBを超える動画（50MBまで）をメッセージで送る。約1.9MBずつのかけら（att-part）で送り、受け取る側は全部そろったらつなげて出す。
//  ① A が 5MB の動画を選んで送る（確認に「はい」）→ B に同じ中身が届く・A は「送信中… N%」→ 送信済み → 相手の受け取り（ps）
//  ② 途中のかけらが1回失敗しても（中継所への PUT を1回だけ 500 にする）続きから送って届く
//  ③ 50MB を超える動画は断る ④ 送っている途中でアプリが読み込み直されても、開き直した後に続きから送って届く
// 使い方: bash tools/run_e2e.sh tools/e2e/big_video.js
const {chromium}=require('playwright'); const crypto=require('crypto');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'v');const PS='https://zatsugaku-push.pprnt908.workers.dev';
let failOnce=0, failAll=0;
async function dev(b,me,peer,host,isA){const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC})=>{ if(sessionStorage.getItem('i'))return; sessionStorage.setItem('i','1'); localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{me,peer,host,SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')});
   if(u.startsWith(PS)){ if(isA&&failOnce===1&&r.request().method()==='PUT'&&/filename=/.test(u)){ failOnce=2; return r.fulfill({status:500,body:'x'}); } if(isA&&failAll&&r.request().method()==='PUT'&&/filename=/.test(u)) return r.fulfill({status:500,body:'x'}); return r.continue(); } return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>{ if(!/ServiceWorker/.test(e.message)) errs.push(e.message); }); pg.on('dialog',d=>{ pg.__dlg=(pg.__dlg||[]).concat(d.message()); d.accept(); });
 await pg.goto('https://zg.test/index.html'); return {pg,errs};}
function fakeMp4(size,seed){ const b=Buffer.alloc(size); crypto.randomFillSync(b); const head=Buffer.from('000000206674797069736f6d0000020069736f6d69736f32617663316d703431','hex'); head.copy(b,0); b[size-1]=seed; return b; }
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true,true), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false,false);
 await A.pg.waitForTimeout(9000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 const res={};
 const send=async(buf,name)=>{ await A.pg.setInputFiles('#chat-photo-file',{name,mimeType:'video/mp4',buffer:buf}); };
 const waitB=async(size,sec)=>{ for(let i=0;i<sec*2;i++){ await B.pg.waitForTimeout(500); const r=await B.pg.evaluate(async(size)=>{ const m=__t.S.chat.find(m=>m.file&&m.from!==__t.S.me.id&&m.fileSize===size); if(!m) return null; const b64=m.data.split(',')[1]; const bin=atob(b64); const u=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); const h=await crypto.subtle.digest('SHA-256',u); return {len:u.length,h:[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join(''),mime:m.data.slice(5,20),video:!!document.querySelector('#chat-log video')}; },size); if(r){ await B.pg.waitForTimeout(1200); r.video=await B.pg.evaluate(()=>!!document.querySelector('#chat-log video')); return r; } } return null; };
 const metaA=(size)=>A.pg.evaluate((size)=>{ const m=__t.S.chat.find(m=>m.file&&m.fileSize===size); return m?__t.metaText(m,true,m.at,true):null; },size);
 // ①
 const v1=fakeMp4((+process.env.BIG||5)*1024*1024,1); const t0=Date.now(); await send(v1,'v1.mp4');
 res.prog=''; for(let i=0;i<40&&!/%/.test(res.prog);i++){ const t=await metaA(v1.length); if(t&&/%/.test(t)) res.prog=t; await A.pg.waitForTimeout(50); }
 res.b1=await waitB(v1.length,90); res.sec1=Math.round((Date.now()-t0)/1000);
 res.h1=crypto.createHash('sha256').update(v1).digest('hex');
 await A.pg.waitForTimeout(4000); res.meta1=await metaA(v1.length);
 res.dlg=A.pg.__dlg;
 // ②
 failOnce=1; const v2=fakeMp4(3*1024*1024+123,2); await send(v2,'v2.mp4');
 res.b2=await waitB(v2.length,120); res.h2=crypto.createHash('sha256').update(v2).digest('hex'); res.failed=failOnce;
 await A.pg.waitForTimeout(3000); res.meta2=await metaA(v2.length);
 // ③
 const before=await A.pg.evaluate(()=>__t.S.chat.length);
 const fp=require('os').tmpdir()+'/zg_big_51.mp4'; require('fs').writeFileSync(fp,fakeMp4(51*1024*1024,3)); await A.pg.setInputFiles('#chat-photo-file',fp); await A.pg.waitForTimeout(1500);
 res.over=await A.pg.evaluate((n)=>({added:__t.S.chat.length-n,toast:(document.getElementById('toast')||{}).textContent||''}),before);
 // ④ 送っている途中でアプリが読み込み直された → 開き直した後に続きから送って届く
 failAll=1; const v4=fakeMp4(4*1024*1024+7,4); await send(v4,'v4.mp4'); await A.pg.waitForTimeout(3000);
 res.before4=await metaA(v4.length);
 await A.pg.reload(); failAll=0; await A.pg.waitForTimeout(6000);
 await A.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 res.b4=await waitB(v4.length,90); res.h4=crypto.createHash('sha256').update(v4).digest('hex');
 res.errs=A.errs.concat(B.errs);
 console.log(JSON.stringify(res));
 const ok=res.b1&&res.b1.h===res.h1&&res.b1.len===v1.length&&/video\/mp4/.test(res.b1.mime)&&res.b1.video&&/送信中… \d+%/.test(res.prog||'')&&/未読|既読|未確認/.test(res.meta1||'')
  &&res.b2&&res.b2.h===res.h2&&res.failed===2&&/未読|既読|未確認/.test(res.meta2||'')&&res.b4&&res.b4.h===res.h4&&/送信中/.test(res.before4||'')&&res.over.added===0&&/50 MB/.test(res.over.toast)&&!res.errs.length;
 console.log(ok?'OK: 大きい動画が分けて届く':'NG'); await b.close(); process.exit(ok?0:1);})();
