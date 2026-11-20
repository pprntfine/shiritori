// v516: 大きい写真（2MB 近く）を3枚続けて受け取っている最中に送ったメッセージが、相手に出るまでの時間。
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
 const pids=await A.pg.evaluate(()=>{ const out=[]; for(let k=0;k<3;k++){ const c=document.createElement('canvas'); c.width=3000; c.height=4000; const x=c.getContext('2d'); x.fillStyle='#888'; x.fillRect(0,0,3000,4000);
   const id=x.getImageData(0,0,3000,4000), d=id.data; for(let i=0;i<d.length;i+=4){ const n=(Math.random()*90-45)|0; d[i]+=n; d[i+1]+=n; d[i+2]+=n; } x.putImageData(id,0,0);
   const data=c.toDataURL('image/jpeg',0.95), pid='P'+k+Date.now().toString(36);
   const msg={from:__t.S.me.id,at:Date.now(),data,pid,uid:String(9100+k),sent:false,n:0,photo:true}; __t.S.chat.push(msg); __t.renderChat(true); __t.sendPhoto(msg); out.push(pid); } return out; });
 // 写真のファイルが送られ始めたら、メッセージを送る
 for(let i=0;i<60;i++){ const s=await A.pg.evaluate(()=>__t.S.chat.filter(m=>m.photo&&m.sent).length); if(s>=1) break; await A.pg.waitForTimeout(500); }
 const during=[]; for(let i=0;i<3;i++){ during.push(await one(A,B,'受け取り中 '+i)); await A.pg.waitForTimeout(300); }
 let done=null; for(let i=0;i<120;i++){ done=await B.pg.evaluate((p)=>p.every(id=>__t.S.chat.some(m=>m.photo&&m.pid===id&&m.data)),pids); if(done) break; await A.pg.waitForTimeout(1000); }
 const maxD=Math.max.apply(null,during.map(x=>x===null?99999:x));
 console.log('ふだん(ms)',JSON.stringify(base),'写真の受け取り中(ms)',JSON.stringify(during),'写真3枚とも届いた',!!done);
 const ok=!!done&&maxD<3000;
 console.log(ok?'OK: 写真を受け取っている間もメッセージはすぐ届く':'NG');
 await b.close(); process.exit(ok?0:1);})();
