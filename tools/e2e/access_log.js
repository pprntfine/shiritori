const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+'c'.repeat(24);
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 await ctx.addInitScript(({SK,TOPIC})=>{ localStorage.setItem('mtp_id_v1','aaaaaaaa11'); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:1,peer:'bbbbbbbb22',peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); return r.abort();});
 const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(3500);
 const res=await pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true;
   __t.show('play'); __t.setTab('chat'); __t.S.isHost=true; __t.S.opp={id:'bbbbbbbb22',name:'あいて'};
   localStorage.removeItem('zg_peer_log');
   const now=Date.now();
   __t.peerChatOpen(now-3*3600e3,false,'touch',{r:'play',pv:'v482',f:'bbbbbbbb22'});
   __t.plogNoteMsg(now-3*3600e3+20000,'m1',now-3*3600e3+24000);
   __t.plogMarkRead(now-3*3600e3+30000);
   __t.peerChatOpen(now-26*3600e3,false,'screen',{r:'play',pv:'v480',f:'bbbbbbbb22'});
   // guess then real within 10 s -> should be one entry
   __t.peerChatOpen(now-60000,false,'guess');
   __t.peerChatOpen(now-50000,false,'touch',{r:'play',pv:'v483',f:'bbbbbbbb22'});
   __t.plogAdd('net',now-2*3600e3,'back',{r:'',f:'bbbbbbbb22'});
   __t.plogAdd('off',now-2.5*3600e3,'',{f:'bbbbbbbb22'});
   return JSON.parse(localStorage.getItem('zg_peer_log')).map(e=>e.k+':'+e.p+':'+(e.r||''));
 });
 console.log(res);
 for(let i=0;i<5;i++){ await pg.click('.brand',{force:true}); await pg.waitForTimeout(100); }
 await pg.waitForTimeout(800);
 await pg.screenshot({path:'plog.png'});
 console.log('errs',errs.filter(e=>!/ServiceWorker/.test(e)));
 await b.close();})();
