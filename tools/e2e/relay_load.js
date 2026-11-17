// v504: 中継所への保存の回数を数える（Durable Objects の1日の上限対策）。
// 2台開いたまま60秒 → 相手(B)が閉じて、A が2通送り120秒。中継所への保存（POST/PUT、cache=no 以外）と、保存しない流すだけ（cache=no）を数える。
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'5');const PS='https://zatsugaku-push.pprnt908.workers.dev';
const cnt={A:{store:0,flow:0},B:{store:0,flow:0}};
async function dev(b,me,peer,host,who){const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC})=>{ if(sessionStorage.getItem('i'))return; sessionStorage.setItem('i','1'); localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{me,peer,host,SK,TOPIC});
 await ctx.route('**/*',async r=>{const q=r.request(),u=q.url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')});
  if(u.startsWith(PS)){ if(/\/r\/[^/?]+(\?|$)/.test(u.slice(PS.length))&&(q.method()==='POST'||q.method()==='PUT')){ if(/[?&]cache=no/.test(u)) cnt[who].flow++; else cnt[who].store++; } return r.continue(); } return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); return {pg};}
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true,'A'), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false,'B');
 await A.pg.waitForTimeout(8000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 await A.pg.fill('#in-chat','はじめ'); await A.pg.click('#btn-chat-send'); await B.pg.fill('#in-chat','へんじ'); await B.pg.click('#btn-chat-send');
 await A.pg.waitForTimeout(5000);
 for(const k of ['A','B']){ cnt[k].store=0; cnt[k].flow=0; }
 await A.pg.waitForTimeout(60000);
 const open60=JSON.parse(JSON.stringify(cnt));
 await B.pg.close(); for(const k of ['A','B']){ cnt[k].store=0; cnt[k].flow=0; }
 await A.pg.fill('#in-chat','とじている間1'); await A.pg.click('#btn-chat-send'); await A.pg.fill('#in-chat','とじている間2'); await A.pg.click('#btn-chat-send');
 await A.pg.waitForTimeout(120000);
 console.log('2台開いて60秒（保存/流すだけ）', JSON.stringify(open60));
 console.log('相手が閉じて2通・120秒 A（保存/流すだけ）', JSON.stringify(cnt.A));
 await b.close();})();
