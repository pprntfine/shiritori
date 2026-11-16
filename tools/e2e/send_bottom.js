const {chromium,devices}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+'c'.repeat(24);
(async()=>{const b=await chromium.launch();
 for(const up of [0,1500]){
 const ctx=await b.newContext({...devices['Pixel 7']});
 await ctx.addInitScript(({SK,TOPIC})=>{ localStorage.setItem('mtp_id_v1','aaaaaaaa11'); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:1,peer:'bbbbbbbb22',peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); return r.abort();});
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(4000);
 await pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); __t.S.paired=true;
   for(let i=0;i<40;i++) __t.S.chat.push({uid:'u'+i,mid:'m'+i,from:i%2?'bbbbbbbb22':'aaaaaaaa11',text:'メッセージ '+i,at:Date.now()-60000+i,sent:true,n:i+1,read:true});
   __t.renderChat(true); });
 await pg.waitForTimeout(800);
 await pg.evaluate(up=>{ const l=document.getElementById('chat-log'); l.scrollTop=Math.max(0,l.scrollHeight-l.clientHeight-up); },up);
 await pg.tap('#in-chat'); await pg.evaluate(()=>{ document.documentElement.style.setProperty('--app-h','450px'); });
 await pg.fill('#in-chat','いま送ったメッセージ\n2行目\n3行目');
 await pg.tap('#btn-chat-send');
 await pg.waitForTimeout(2000);
 const r=await pg.evaluate(()=>{const log=document.getElementById('chat-log');const ms=[...log.querySelectorAll('.msg')];const last=ms[ms.length-1];const lr=log.getBoundingClientRect(),q=last.getBoundingClientRect();return {lastText:last.innerText.split('\n').slice(-1)[0].slice(0,20),visible:q.bottom<=lr.bottom+2&&q.top>=lr.top-2,dist:Math.round(log.scrollHeight-log.scrollTop-log.clientHeight)};});
 console.log('読んでいた位置: 下から',up,'px →',JSON.stringify(r));
 await ctx.close(); }
 await b.close();})();
