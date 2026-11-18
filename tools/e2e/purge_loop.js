// 既読から15分で消えた後、「消して」の合図（purge・recall）が止まらず中継所に保存され続けないか（2026-11-18 の書き込み上限の原因）。
// 時計を16分進めて消えさせ、その後の保存を種類ごとに数える。
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
 await A.waitForTimeout(8000);
 const before=await A.evaluate(()=>__t.S.chat.filter(m=>!m.sys).length);
 for(const p of [A,B]) await p.evaluate(()=>{ window.__shift=16*60*1000; });   // 16分たったことにする（既読から15分で消える）
 await A.waitForTimeout(12000);
 const after=await A.evaluate(()=>__t.S.chat.filter(m=>!m.sys).length);
 console.log('消える前',before,'通 → 16分後',after,'通');
 for(const [n,p] of [['A',A],['B',B]]) console.log(n,'消えた直後の送信',JSON.stringify(await p.evaluate(()=>window.__byT)),'purge控え',await p.evaluate(()=>(JSON.parse(localStorage.getItem('zg.purge1')||'[]')).length),'受けた控え',await p.evaluate(()=>(JSON.parse(localStorage.getItem('zg.purgein1')||'[]')).length));
 for(const k in net) delete net[k]; for(const p of [A,B]) await p.evaluate(()=>{ window.__byT={}; });
 console.log('そのまま'+MIN+'分置いて、保存を数える…');
 await A.waitForTimeout(MIN*60000);
 for(const [n,p] of [['A',A],['B',B]]) console.log(n,'最後のpurge控え',await p.evaluate(()=>(JSON.parse(localStorage.getItem('zg.purge1')||'[]')).length));
 const a=await A.evaluate(()=>window.__byT), bb=await B.evaluate(()=>window.__byT);
 console.log('A 種類ごと:',JSON.stringify(a)); console.log('B 種類ごと:',JSON.stringify(bb));
 console.log('中継所への通信:',JSON.stringify(net));
 const purge=(a['purge(保存)']||0)+(bb['purge(保存)']||0), recall=(a['recall(保存)']||0)+(bb['recall(保存)']||0);
 const st=Object.entries(net).filter(([k])=>k.includes('(保存)')||k.includes('PUT')).reduce((s,[,v])=>s+v,0);
 console.log('保存した回数（合計）',st,'／ 1時間あたりに直すと 約',Math.round(st/(MIN+0.5)*60),'回');
 console.log((purge+recall)<=6?'OK: 消した後の合図はすぐ止まる（purge '+purge+'・recall '+recall+'）':'NG: 消した後の合図が止まらない（purge '+purge+'・recall '+recall+'）');
 await b.close(); process.exit((purge+recall)<=6?0:1);})();
