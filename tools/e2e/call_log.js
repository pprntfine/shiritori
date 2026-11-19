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
 // 1) A calls, B answers, 4s, A hangs up
 await A.pg.click('#zg-hd-call'); let ok=false; for(let i=0;i<40&&!ok;i++){ await B.pg.waitForTimeout(300); ok=await B.pg.evaluate(()=>!!document.getElementById('ca-yes')); }
 console.log('B rings:',ok); await B.pg.click('#ca-yes');
 let con=false; for(let i=0;i<40&&!con;i++){ await A.pg.waitForTimeout(300); con=await A.pg.evaluate(()=>/通話中/.test(document.getElementById('btn-call').textContent)); }
 console.log('connected:',con); await A.pg.waitForTimeout(4000);
 await A.pg.evaluate(()=>{ const b=document.querySelector('#call-end, #call-hang, .call-end')||[...document.querySelectorAll('#call-box button')].find(x=>/電話を切る/.test(x.textContent)); b?b.click():document.getElementById('btn-call').click(); });
 await A.pg.waitForTimeout(3000);
 console.log('1 A:',await logs(A),'B:',await logs(B));
 // 2) A calls, B declines
 await A.pg.waitForTimeout(3000); await A.pg.click('#zg-hd-call'); ok=false; for(let i=0;i<40&&!ok;i++){ await B.pg.waitForTimeout(300); ok=await B.pg.evaluate(()=>!!document.getElementById('ca-no')); }
 await B.pg.click('#ca-no'); await A.pg.waitForTimeout(4000);
 console.log('2 A:',(await logs(A)).slice(1),'B:',(await logs(B)).slice(1));
 // 3) A calls, then cancels before answer
 await A.pg.waitForTimeout(3000); await A.pg.click('#zg-hd-call'); ok=false; for(let i=0;i<40&&!ok;i++){ await B.pg.waitForTimeout(300); ok=await B.pg.evaluate(()=>!!document.getElementById('ca-no')); }
 await A.pg.evaluate(()=>{ const b=[...document.querySelectorAll('#call-box button, #call-center button')].find(x=>/電話を切る/.test(x.textContent)); b?b.click():document.getElementById('btn-call').click(); });
 await A.pg.waitForTimeout(5000);
 console.log('3 A:',(await logs(A)).slice(2),'B:',(await logs(B)).slice(2));
 // reload A, check persisted
 await A.pg.waitForTimeout(2500);
 const p2=await A.ctx.newPage(); await A.pg.close(); await p2.goto('https://zg.test/index.html'); await p2.waitForTimeout(6000);
 console.log('A after reopen:',await p2.evaluate(()=>__t.S.chat.filter(m=>m.callLog).map(m=>m.text)));
 await b.close();})();
