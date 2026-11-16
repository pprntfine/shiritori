const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'d');const PS='https://zatsugaku-push.pprnt908.workers.dev';
async function dev(b,me,peer,host){const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC})=>{ if(sessionStorage.getItem('i'))return; sessionStorage.setItem('i','1'); localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{me,peer,host,SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); if(u.startsWith(PS))return r.continue(); return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); return {pg};}
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false);
 await A.pg.waitForTimeout(8000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 const send=async(d,txt)=>{ await d.pg.fill('#in-chat',txt); await d.pg.click('#btn-chat-send'); };
 await send(A,'はじめ'); await A.pg.waitForTimeout(3000);
 await B.pg.close();   // partner closes the app
 await send(A,'とじている間1'); await send(A,'とじている間2');
 await A.pg.waitForTimeout(1500);
 await A.pg.evaluate(()=>{ window.__rb=0; window.__gone=[]; window.__watch=['はじめ','とじている間1','とじている間2']; });
 await A.pg.waitForTimeout(130000);
 const r=await A.pg.evaluate(()=>({rebuildRemovedRows:__rb,goneSamples:__gone.length,first:__gone.slice(0,5),dom:[...document.querySelectorAll("#chat-log .msg.out .meta")].map(e=>e.textContent),meta:__t.S.chat.filter(m=>m.from===__t.S.me.id&&!m.sys).map(m=>m.text+'='+__t.metaText(m,true,m.at,true))}));
 console.log(JSON.stringify(r));
 await b.close();})();
