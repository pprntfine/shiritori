// v516: ストーリーの大きい動画（8つに分けて送る）を受け取っている最中に送ったメッセージが、相手に出るまでの時間。
// 中身のファイルの受け取り（GET）を1つ2秒遅らせる（弱い電波の代わり）。以前は受け取りが1つずつ順番で、動画の受け取りが終わるまでメッセージが待たされた。
// （もとの latency.js の説明）送信ボタンから相手の画面にメッセージが出るまでの時間（アプリの処理分。ntfy.sh・MQTT はふさぎ、中継所だけ。実際の回線の遅れは含まない）。
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'h');const PS='https://zatsugaku-push.pprnt908.workers.dev';
const DELAY=+(process.env.NET_DELAY_MS||0);   // 回線の往復の遅れ（ミリ秒）を足して測る
async function dev(b,me,peer,host){const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC})=>{ if(sessionStorage.getItem('i'))return; sessionStorage.setItem('i','1'); localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{me,peer,host,SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url();
  if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')});
  if(u.startsWith(PS)){ if(r.request().method()==='GET'&&/\/r\//.test(u)&&!/json|poll|\/ws/.test(u)) await new Promise(x=>setTimeout(x,2000)); return r.continue(); } return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); return {pg,ctx};}
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false);
 await A.pg.waitForTimeout(9000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 const res=[];
 async function one(from,to,txt){
   await to.pg.evaluate(t=>{ window.__seen=null; const iv=setInterval(()=>{ if(__t.S.chat.some(m=>m.text===t)){ window.__seen=performance.timeOrigin+performance.now(); clearInterval(iv);} },10); },txt);
   await from.pg.fill('#in-chat',txt);
   const t0=await from.pg.evaluate(()=>{ const t=performance.timeOrigin+performance.now(); document.getElementById('btn-chat-send').click(); return t; });
   let seen=null; for(let i=0;i<400&&!seen;i++){ await to.pg.waitForTimeout(25); seen=await to.pg.evaluate(()=>window.__seen); }
   return seen?Math.round(seen-t0):null;
 }
 await one(A,B,'ならし1'); await one(B,A,'ならし2');
 const base=[]; for(let i=0;i<3;i++){ base.push(await one(A,B,'ふだん '+i)); await A.pg.waitForTimeout(500); }
 await A.pg.evaluate(async()=>{ const n=15000000, b=new Uint8Array(n); for(let i=0;i<n;i+=65536) crypto.getRandomValues(b.subarray(i,Math.min(n,i+65536))); window.__zgStory.post('vid','video/mp4',b,30,[]); });
 // 中身を送り始めて少ししてから、メッセージを送る
 for(let i=0;i<40;i++){ const g=await B.pg.evaluate(()=>{ const l=window.__zgStory.list('aaaaaaaa11'); return l[0]?(l[0].got||[]).length:-1; }); if(g>=1) break; await A.pg.waitForTimeout(500); }
 const during=[]; for(let i=0;i<3;i++){ during.push(await one(A,B,'受け取り中 '+i)); await A.pg.waitForTimeout(300); }
 let done=null; for(let i=0;i<120;i++){ done=await B.pg.evaluate(()=>{ const l=window.__zgStory.list('aaaaaaaa11'); return l[0]&&l[0].complete; }); if(done) break; await A.pg.waitForTimeout(1000); }
 const maxD=Math.max.apply(null,during.map(x=>x===null?99999:x));
 console.log('ふだん(ms)',JSON.stringify(base),'動画の受け取り中(ms)',JSON.stringify(during),'動画もそろった',!!done);
 const ok=!!done&&maxD<3000;
 console.log(ok?'OK: 動画を受け取っている間もメッセージはすぐ届く':'NG');
 await b.close(); process.exit(ok?0:1);})();
