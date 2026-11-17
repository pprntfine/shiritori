// v497: 受信箱（zg-inbox）に、戻ってきた自分の暗号文がたまらない。10往復しても数件以内。
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'c');const PS='https://zatsugaku-push.pprnt908.workers.dev';
async function dev(b,me,peer,host){const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC})=>{ if(sessionStorage.getItem('i'))return; sessionStorage.setItem('i','1'); localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{me,peer,host,SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); if(u.startsWith(PS))return r.continue(); return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); return {pg};}
const rows=(d)=>d.pg.evaluate(()=>new Promise(res=>{ const r=indexedDB.open('zg-inbox',1); r.onupgradeneeded=()=>r.result.createObjectStore('m'); r.onsuccess=()=>{ const db=r.result; if(!db.objectStoreNames.contains('m')){res(0);return;} const q=db.transaction('m').objectStore('m').count(); q.onsuccess=()=>{res(q.result); db.close();}; }; r.onerror=()=>res(-1); }));
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false);
 await A.pg.waitForTimeout(8000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 console.log('はじめ  A',await rows(A),'B',await rows(B));
 for(let i=0;i<10;i++){ await A.pg.fill('#in-chat','A'+i); await A.pg.click('#btn-chat-send'); await B.pg.fill('#in-chat','B'+i); await B.pg.click('#btn-chat-send'); await A.pg.waitForTimeout(1500); }
 await A.pg.waitForTimeout(15000);
 console.log('10往復後 A',await rows(A),'B',await rows(B));
 const kinds=(d)=>d.pg.evaluate(()=>new Promise(res=>{ const r=indexedDB.open('zg-inbox',1); r.onsuccess=()=>{ const db=r.result; const q=db.transaction('m').objectStore('m').getAll(); q.onsuccess=async()=>{ const out={}; for(const v of q.result){ let k; try{ const env=await __t.unseal(String(v.b||''),__t.Net.key); k=(env.from===__t.S.me.id?'自分:':'相手:')+env.t; }catch(e){ k='読めない'; } out[k]=(out[k]||0)+1; } res(out); db.close(); }; }; }));
 console.log('内訳 A',JSON.stringify(await kinds(A))); console.log('内訳 B',JSON.stringify(await kinds(B)));
 const T=Number(process.env.WAIT||0); if(T){ await A.pg.waitForTimeout(T); console.log(T/1000+'秒後 A',await rows(A),'B',await rows(B)); }
 const ra=await rows(A), rb=await rows(B);
 const ok=ra<=6&&rb<=6; console.log(ok?'OK: 受信箱にたまらない':'NG: 受信箱にたまっている');
 await b.close(); process.exit(ok?0:1);})();
