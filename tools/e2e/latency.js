// 送信ボタンから相手の画面にメッセージが出るまでの時間（アプリの処理分。ntfy.sh・MQTT はふさぎ、中継所だけ。実際の回線の遅れは含まない）。
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'h');const PS='https://zatsugaku-push.pprnt908.workers.dev';
const DELAY=+(process.env.NET_DELAY_MS||0);   // 回線の往復の遅れ（ミリ秒）を足して測る
async function dev(b,me,peer,host){const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC})=>{ if(sessionStorage.getItem('i'))return; sessionStorage.setItem('i','1'); localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{me,peer,host,SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url();
  if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')});
  if(u.startsWith(PS)){ if(DELAY) await new Promise(x=>setTimeout(x,DELAY)); return r.continue(); } return r.abort();});
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
 for(let i=0;i<5;i++){ res.push(await one(A,B,'A→B '+i)); await A.pg.waitForTimeout(700); res.push(await one(B,A,'B→A '+i)); await A.pg.waitForTimeout(700); }
 const ok=res.filter(x=>x!==null).sort((a,c)=>a-c);
 console.log('回線の遅れ',DELAY,'ms／10通の表示までの時間(ms):',JSON.stringify(res),'中央値',ok[Math.floor(ok.length/2)],'最大',ok[ok.length-1],'届かなかった',res.filter(x=>x===null).length);
 await b.close();})();
