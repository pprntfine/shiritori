const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'a');const PS='https://zatsugaku-push.pprnt908.workers.dev';
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({SK,TOPIC})=>{ if(sessionStorage.getItem('i'))return; sessionStorage.setItem('i','1'); localStorage.setItem('mtp_id_v1','aaaaaaaa11'); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:1,peer:'bbbbbbbb22',peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); if(u.startsWith(PS))return r.continue(); return r.abort();});
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(7000);
 const st=()=>pg.evaluate(()=>{const w=document.getElementById('storage-warning');return w&&!w.hidden?w.innerText.slice(0,30):'なし';});
 console.log('ready',await pg.evaluate(()=>({scope:!!__t.privateScope(),loaded:__t.S.chatLoaded})));
 // fail once
 await pg.evaluate(()=>{ window.__fails=1; const op=IDBObjectStore.prototype.put; IDBObjectStore.prototype.put=function(){ if(window.__fails>0){ window.__fails--; throw new DOMException('aborted','AbortError'); } return op.apply(this,arguments); }; __t.S.chat.push({uid:'x1',mid:'x1',from:'aaaaaaaa11',text:'テスト',at:Date.now(),sent:true,n:1}); __t.chatSaveNow().catch(()=>{}); });
 await pg.waitForTimeout(500); console.log('一回失敗 直後:',await st()); await pg.waitForTimeout(4000); console.log('一回失敗 4.5秒後:',await st());
 // fail always
 await pg.evaluate(()=>{ window.__fails=99; __t.chatSaveNow().catch(()=>{}); });
 await pg.waitForTimeout(4500); console.log('ずっと失敗:',await st());
 await pg.evaluate(()=>{ window.__fails=0; __t.chatSaveNow().catch(()=>{}); });
 await pg.waitForTimeout(1500); console.log('なおった後:',await st());
 await b.close();})();
