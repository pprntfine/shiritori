const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'c');const PS='https://zatsugaku-push.pprnt908.workers.dev';
async function dev(b,me,peer,host){const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC})=>{ if(sessionStorage.getItem('i'))return; sessionStorage.setItem('i','1'); localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{me,peer,host,SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); if(u.startsWith(PS))return r.continue(); return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); await pg.goto('https://zg.test/index.html'); return {pg,errs};}
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false);
 await A.pg.waitForTimeout(9000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ document.getElementById('storage-warning')&&(document.getElementById('storage-warning').hidden=true); __t.show('play'); __t.setTab('chat'); });
 const send=async(d,txt)=>{ await d.pg.fill('#in-chat',txt); await d.pg.click('#btn-chat-send'); };
 const meta=async(d,txt)=>d.pg.evaluate(t=>{const m=__t.S.chat.find(m=>m.text===t);return m?__t.metaText(m,true,m.at,true):'(none)';},txt);
 const got=async(d,txt)=>d.pg.evaluate(t=>__t.S.chat.some(m=>m.text===t),txt);
 await send(A,'UIテスト1'); await A.pg.waitForTimeout(4000);
 console.log('1 normal  | A shows:',await meta(A,'UIテスト1'),'| B got:',await got(B,'UIテスト1'));
 // cut A's relay WebSocket repeatedly (like iPhone background)
 await A.pg.evaluate(()=>{ for(let i=0;i<5;i++){ try{ __t.Relay.ws&&__t.Relay.ws.close(); }catch(e){} __t.Relay.retry=6; } });
 await send(A,'UIテスト2（線が切れた後）'); await A.pg.waitForTimeout(5000);
 console.log('2 ws cut  | A shows:',await meta(A,'UIテスト2（線が切れた後）'),'| B got:',await got(B,'UIテスト2（線が切れた後）'));
 // B closed, A sends 3 quickly
 const bctx=B.pg.context(); await B.pg.close();
 for(const t of ['UI閉3','UI閉4','UI閉5']) await send(A,t);
 await A.pg.waitForTimeout(5000);
 console.log('3 B closed| A shows:',await meta(A,'UI閉3'),'/',await meta(A,'UI閉5'));
 const pg2=await bctx.newPage(); await pg2.goto('https://zg.test/index.html'); let ok=false; for(let i=0;i<30&&!ok;i++){ await pg2.waitForTimeout(500); ok=await pg2.evaluate(()=>!!(window.__t&&['UI閉3','UI閉4','UI閉5'].every(t=>__t.S.chat.some(m=>m.text===t)))); }
 console.log('  B reopened got all 3:',ok); await A.pg.waitForTimeout(8000); console.log("  A DOM:",await A.pg.evaluate(()=>[...document.querySelectorAll("#chat-log .msg.out .meta")].map(e=>e.textContent).join(" / "))); console.log("  A after B reopen:",await meta(A,'UI閉3'),'/',await meta(A,'UI閉5'),'/ 2:',await meta(A,'UIテスト2（線が切れた後）'));
 console.log('A storage warnings:',await A.pg.evaluate(()=>{const w=document.getElementById('storage-warning');return w&&!w.hidden?w.innerText.slice(0,60):'none';}),'errs',A.errs.slice(0,2));
 await b.close();})();
