// 中継所に「保存」される送信を種類ごとに数える（Durable Objects の書き込み上限の調査用）。
// 2台を開いて会話 → 読む → そのまま数分置く。ntfy・MQTT はふさぐ（MQTT が使えない回線と同じ）。
const {chromium}=require('playwright');
const DIR=process.argv[2], DIR_B=process.env.DIR_B||process.argv[2];   // DIR_B: 相手(B)だけ別の版で試す
const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'w');const PS='https://zatsugaku-push.pprnt908.workers.dev';
const MIN=+(process.env.IDLE_MIN||4);
const net={};   // url種別ごとの数
async function dev(b,me,peer,host,tag){ const D=(tag==='B')?DIR_B:DIR;const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC})=>{ if(localStorage.getItem('mtp_pair_v1'))return; localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{me,peer,host,SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url(),m=r.request().method();
  if(u.startsWith('https://zg.test/'))return r.fulfill({path:D+'/'+(u.split('/').pop().split('?')[0]||'index.html')});
  if(u.startsWith(PS)){ const k=tag+' '+m+' '+(u.includes('/r/')?(u.includes('/json')?'poll':(u.includes('cache=no')?'r(流すだけ)':'r(保存)')):u.replace(PS,'').split('?')[0]); net[k]=(net[k]||0)+1; return r.continue(); }
  return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(6000);
 await pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat');
   window.__byT={}; const N=__t.Net, op=N.post.bind(N), os=N.storeFetch.bind(N);
   N.post=function(env){ window.__curT=env&&env.t; return op.apply(N,arguments); };
   N.storeFetch=function(topic,init,q){ if(init&&init.method==='POST'){ const k=(window.__curT||'?')+((q||'').includes('cache=no')?'(流す)':'(保存)'); window.__byT[k]=(window.__byT[k]||0)+1; } return os.apply(N,arguments); };
 }); return pg;}
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true,'A'), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false,'B');
 await A.waitForTimeout(4000);
 for(const k in net) delete net[k]; for(const p of [A,B]) await p.evaluate(()=>{ window.__byT={}; });
 for(let i=0;i<5;i++){ await A.fill('#in-chat','A'+i); await A.click('#btn-chat-send'); await A.waitForTimeout(1500); await B.fill('#in-chat','B'+i); await B.click('#btn-chat-send'); await B.waitForTimeout(1500); }
 const FLIP=+(process.env.FLIP_SEC||0);   // FLIP_SEC 秒ごとに B の画面を消す/つける（iPhone は消すと受け取り線が切れる）
 if(FLIP){
   console.log('会話10通のあと、'+MIN+'分のあいだ B の画面を '+FLIP+'秒ごとに消す・つける…');
   const end=Date.now()+MIN*60000; let hidden=false;
   while(Date.now()<end){ hidden=!hidden;
     await B.evaluate(h=>{ Object.defineProperty(document,'hidden',{get:()=>h,configurable:true}); Object.defineProperty(document,'visibilityState',{get:()=>h?'hidden':'visible',configurable:true}); if(h){ try{ __t.Relay.ws&&__t.Relay.ws.close(); }catch(e){} } document.dispatchEvent(new Event('visibilitychange')); },hidden);
     await B.waitForTimeout(FLIP*1000); }
   await B.evaluate(()=>{ Object.defineProperty(document,'hidden',{get:()=>false,configurable:true}); Object.defineProperty(document,'visibilityState',{get:()=>'visible',configurable:true}); document.dispatchEvent(new Event('visibilitychange')); });
 } else {
 console.log('会話10通のあと、'+MIN+'分そのまま置く…');
 await A.waitForTimeout(MIN*60000);
 }
 const a=await A.evaluate(()=>window.__byT), bb=await B.evaluate(()=>window.__byT);
 console.log('A 種類ごと:',JSON.stringify(a)); console.log('B 種類ごと:',JSON.stringify(bb));
 console.log('中継所への通信:',JSON.stringify(net));
 const st=Object.entries(net).filter(([k])=>k.includes('(保存)')||k.includes('PUT')).reduce((s,[,v])=>s+v,0);
 console.log('保存した回数（合計）',st,'／ 1時間あたりに直すと 約',Math.round(st/(MIN+0.5)*60),'回');
 await b.close();})();
