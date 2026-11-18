// v507: 中継所の返事が一度だけ遅い（弱い電波）時に、送ったメッセージが「送信中」のまま長く止まらない。
// ntfy.sh・MQTT はふさぎ、最初の10秒だけ中継所への送信（POST）を6秒遅らせる。送ってから「送信済み」になるまでを測る。
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'g');const PS='https://zatsugaku-push.pprnt908.workers.dev';
let slowUntil=0;
async function dev(b,me,peer,host,slow){const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC})=>{ if(sessionStorage.getItem('i'))return; sessionStorage.setItem('i','1'); localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{me,peer,host,SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url();
  if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')});
  if(slow&&u.startsWith(PS+'/r/')&&r.request().method()==='POST'&&Date.now()<slowUntil){ await new Promise(x=>setTimeout(x,6000)); }
  if(u.startsWith(PS))return r.continue(); return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); return {pg};}
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true,true), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false,false);
 await A.pg.waitForTimeout(8000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 await A.pg.fill('#in-chat','ならし'); await A.pg.click('#btn-chat-send'); await A.pg.waitForTimeout(3000);
 slowUntil=Date.now()+10000; const t0=Date.now();
 await A.pg.fill('#in-chat','おそい回線'); await A.pg.click('#btn-chat-send');
 let sentAt=null;
 for(let i=0;i<240&&sentAt===null;i++){ await A.pg.waitForTimeout(500); const st=await A.pg.evaluate(()=>{const m=__t.S.chat.find(m=>m.text==='おそい回線'); return m&&m.sent===true;}); if(st) sentAt=Date.now()-t0; }
 console.log('送ってから「送信済み」まで',sentAt===null?'120秒以上（送信中のまま）':(Math.round(sentAt/1000)+'秒'));
 const ok=sentAt!==null&&sentAt<=20000;
 console.log(ok?'OK: 遅い回線でも20秒以内に送信済み':'NG: 送信中のまま長く止まった');
 await b.close(); process.exit(ok?0:1);})();
