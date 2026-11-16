const {chromium,devices}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+'c'.repeat(24);
(async()=>{const b=await chromium.launch();
 for(const startDist of [0,200]){
 const ctx=await b.newContext({...devices['Pixel 7']});
 await ctx.addInitScript(({SK,TOPIC})=>{ localStorage.setItem('mtp_id_v1','aaaaaaaa11'); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:1,peer:'bbbbbbbb22',peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); return r.abort();});
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(3500);
 await pg.evaluate((sd)=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat');
   for(let i=0;i<30;i++) __t.S.chat.push({uid:'u'+i,mid:'m'+i,from:i%2?'bbbbbbbb22':'aaaaaaaa11',text:(i==29?'さいごの受信':'メッセージ '+i),at:Date.now()-60000+i,sent:true,n:i+1,read:true});
   __t.renderChat(true); setTimeout(()=>{const l=document.getElementById('chat-log'); l.scrollTop=l.scrollHeight-l.clientHeight-sd;},400); },startDist);
 await pg.waitForTimeout(1200);
 // tap input -> then keyboard shrinks viewport (simulate via --app-h like vv() does), later in steps
 await pg.tap('#in-chat');
 for(const h of [700,520,430]){ await pg.waitForTimeout(120); await pg.evaluate(h=>{ document.documentElement.style.setProperty('--app-h',h+'px'); document.body.classList.add('kb-open'); },h); }
 await pg.waitForTimeout(1600);
 const r=await pg.evaluate(()=>{const log=document.getElementById('chat-log');const ms=log.querySelectorAll('.msg');const last=ms[ms.length-1];const lr=log.getBoundingClientRect(),q=last.getBoundingClientRect();return {lastVisible:q.bottom<=lr.bottom+2&&q.top>=lr.top,dist:Math.round(log.scrollHeight-log.scrollTop-log.clientHeight)};});
 console.log('start dist',startDist,'->',JSON.stringify(r));
 await ctx.close(); }
 await b.close();})();
