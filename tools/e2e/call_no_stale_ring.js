const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'b');const PS='https://zatsugaku-push.pprnt908.workers.dev';
async function dev(b,me,peer,host){const ctx=await b.newContext({viewport:{width:390,height:844},permissions:['microphone','camera']});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC})=>{ if(sessionStorage.getItem('i'))return; sessionStorage.setItem('i','1'); localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{me,peer,host,SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); if(u.startsWith(PS))return r.continue(); return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); pg.on('dialog',d=>d.accept()); await pg.goto('https://zg.test/index.html'); return {pg,ctx};}
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false);
 await A.pg.waitForTimeout(9000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 const logs=d=>d.pg.evaluate(()=>__t.S.chat.filter(m=>m.callLog).map(m=>m.text));
 await B.pg.close();
 await A.pg.click('#zg-hd-call'); await A.pg.waitForTimeout(8000);
 await A.pg.evaluate(()=>{ const b=[...document.querySelectorAll('#call-box button, #call-center button')].find(x=>/電話を切る/.test(x.textContent)); b?b.click():document.getElementById('btn-call').click(); });
 await A.pg.waitForTimeout(20000);
 const p2=await B.ctx.newPage(); await p2.goto('https://zg.test/index.html'); let rang=false; for(let i=0;i<40&&!rang;i++){ await p2.waitForTimeout(300); rang=await p2.evaluate(()=>!!document.getElementById('ca-yes')); }
 console.log('閉じていたBを30秒後に開くと鳴る?',rang);
 await b.close();})();
