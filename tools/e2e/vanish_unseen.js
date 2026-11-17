// v494: 受け取ったメッセージは、トーク画面で見るまで「15分で消える」時計を始めない。
// B（受け取る側）はトップ画面のまま → 16分すすめても消えない。トークで見た後に16分すすめると消える（消える設定は生きている）。
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'f');const PS='https://zatsugaku-push.pprnt908.workers.dev';
async function dev(b,me,peer,host){const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC})=>{ if(sessionStorage.getItem('i'))return; sessionStorage.setItem('i','1'); localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{me,peer,host,SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); if(u.startsWith(PS))return r.continue(); return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html');
 await pg.evaluate(()=>{ window.__shift=0; const real=Date.now.bind(Date); Date.now=()=>real()+window.__shift; });
 return {pg};}
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false);
 await A.pg.waitForTimeout(8000);
 await A.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 await B.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('lobby'); });   // B はトップ画面（トークを見ていない）
 await A.pg.fill('#in-chat','みていない'); await A.pg.click('#btn-chat-send');
 await A.pg.waitForTimeout(12000);
 const has=(d)=>d.pg.evaluate(()=>{ const m=__t.S.chat.find(x=>x&&x.text==='みていない'); return m?{in:true,rad:!!m.rad}:{in:false}; });
 const b1=await has(B), a1=await has(A);
 console.log('受信直後  B:',JSON.stringify(b1),' A:',JSON.stringify(a1));
 await B.pg.evaluate(()=>{ window.__shift=16*60*1000; });     // 16分たったことにする
 await B.pg.waitForTimeout(15000); await A.pg.waitForTimeout(8000);
 const b2=await has(B), a2=await has(A);
 console.log('見ずに16分 B:',JSON.stringify(b2),' A:',JSON.stringify(a2));
 await B.pg.evaluate(()=>{ __t.show('play'); __t.setTab('chat'); });   // トークで見る
 await B.pg.waitForTimeout(8000);
 const b3=await has(B);
 console.log('トークで見た B:',JSON.stringify(b3));
 await B.pg.evaluate(()=>{ window.__shift=32*60*1000; });     // 見てから16分
 await B.pg.waitForTimeout(15000);
 const b4=await has(B);
 console.log('見て16分  B:',JSON.stringify(b4));
 const ok=b1.in&&!b1.rad&&b2.in&&a2.in&&b3.in&&b3.rad&&!b4.in;
 console.log(ok?'OK: 見るまで消えない・見たら15分で消える':'NG');
 await b.close(); process.exit(ok?0:1);})();
