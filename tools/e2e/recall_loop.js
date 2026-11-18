// 消えたメッセージの記録（recall）を、届いた後も画面を開くたびに全件送り直していないか（2026-11-18 の書き込み上限の原因）。
// FLAP=1 で ntfy の SSE がつながっては切れる回線も試す。
// 2台に消えた記録を N 件（HIST）入れ、一度届けてから、画面を消す→つけるを2分ごとに繰り返し、保存を数える。
// 2台を開いて会話 → 読む → そのまま数分置く。ntfy・MQTT はふさぐ（MQTT が使えない回線と同じ）。
const {chromium}=require('playwright');
const DIR=process.env.DIR_A||process.argv[2], DIR_B=process.env.DIR_B||DIR;   // DIR_B: 相手(B)だけ別の版で試す
const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'w');const PS='https://zatsugaku-push.pprnt908.workers.dev';
const MIN=+(process.env.IDLE_MIN||4);
const net={};   // url種別ごとの数
async function dev(b,me,peer,host,tag){ const D=(tag==='B')?DIR_B:DIR;const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC})=>{ if(localStorage.getItem('mtp_pair_v1'))return; localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{me,peer,host,SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url(),m=r.request().method();
  if(u.startsWith('https://zg.test/'))return r.fulfill({path:D+'/'+(u.split('/').pop().split('?')[0]||'index.html')});
  if(u.startsWith(PS)){ const k=tag+' '+m+' '+(u.includes('/r/')?(u.includes('/json')?'poll':(u.includes('cache=no')?'r(流すだけ)':'r(保存)')):u.replace(PS,'').split('?')[0]); net[k]=(net[k]||0)+1; return r.continue(); }
  // FLAP=1: ntfy.sh の SSE が、つながってはすぐ切れる（つながるたびに onState('open') が出る）
  if(process.env.FLAP&&u.startsWith('https://ntfy.sh/')&&u.includes('/sse')) return r.fulfill({status:200,headers:{'content-type':'text/event-stream','access-control-allow-origin':'*'},body:': hi\n\n'});
  return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(6000);
 await pg.evaluate(()=>{ window.__shift=0; const real=Date.now.bind(Date); Date.now=()=>real()+window.__shift; }); await pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat');
   window.__byT={}; const N=__t.Net, op=N.post.bind(N), os=N.storeFetch.bind(N);
   N.post=function(env){ window.__curT=env&&env.t; return op.apply(N,arguments); };
   N.storeFetch=function(topic,init,q){ if(init&&init.method==='POST'){ const k=(window.__curT||'?')+((q||'').includes('cache=no')?'(流す)':'(保存)'); window.__byT[k]=(window.__byT[k]||0)+1; } return os.apply(N,arguments); };
 }); return pg;}
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true,'A'), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false,'B');
 await A.waitForTimeout(4000);
 for(const k in net) delete net[k]; for(const p of [A,B]) await p.evaluate(()=>{ window.__byT={}; });
 for(let i=0;i<5;i++){ await A.fill('#in-chat','A'+i); await A.click('#btn-chat-send'); await A.waitForTimeout(1500); await B.fill('#in-chat','B'+i); await B.click('#btn-chat-send'); await B.waitForTimeout(1500); }
 // これまでに消えた自分のメッセージの記録（実機では使うほど増える。100通/日なら2週間で約700件）
 const N=+(process.env.HIST||600);
 for(const [p,me] of [[A,'A'],[B,'B']]) await p.evaluate(async n=>{ const ids=[]; for(let i=0;i<n;i++){ let h=''; for(let k=0;k<32;k++) h+='0123456789abcdef'[(Math.random()*16)|0]; ids.push('M'+h); } await __t.deletionRemember(__t.S.me.id,ids); },N);
 console.log('消えた記録',N,'件ずつ（2台）。一度全部を相手に届ける…');
 await A.waitForTimeout(Math.ceil(N/16)*15000+30000);
 for(const k in net) delete net[k]; for(const p of [A,B]) await p.evaluate(()=>{ window.__byT={}; });
 console.log('届いた後、画面を消す→つけるを2分ごとに（実機でよくある）'+MIN+'分…');
 const t0=Date.now();
 if(process.env.RELOAD){ // アプリを閉じて開き直す（iPhone はよく裏で終わらせる）
   for(const p of [A,B]){ await p.reload(); } await A.waitForTimeout(7000);
   for(const p of [A,B]) await p.evaluate(()=>{ __t.show('play'); __t.setTab('chat'); window.__byT={}; });
   console.log('開き直した');
 }
 while(Date.now()-t0<MIN*60000){ for(const p of [A,B]) await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange'))); await A.waitForTimeout(120000); }
 const a=await A.evaluate(()=>window.__byT), bb=await B.evaluate(()=>window.__byT);
 console.log('A 種類ごと:',JSON.stringify(a)); console.log('B 種類ごと:',JSON.stringify(bb));
 console.log('中継所への通信:',JSON.stringify(net));
 const purge=(a['purge(保存)']||0)+(bb['purge(保存)']||0), recall=(a['recall(保存)']||0)+(bb['recall(保存)']||0);
 const st=Object.entries(net).filter(([k])=>k.includes('(保存)')||k.includes('PUT')).reduce((s,[,v])=>s+v,0);
 console.log('保存した回数（合計）',st,'／ 1時間あたりに直すと 約',Math.round(st/(MIN+0.5)*60),'回');
 console.log((purge+recall)<=6?'OK: 消した後の合図はすぐ止まる（purge '+purge+'・recall '+recall+'）':'NG: 消した後の合図が止まらない（purge '+purge+'・recall '+recall+'）');
 await b.close(); process.exit((purge+recall)<=6?0:1);})();
