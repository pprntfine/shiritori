// 本物のスマホに近い回線（即時路 MQTT と ntfy.sh がつながっている。tools/fake_net.js の にせもの）で、
// ふつうに使った時に中継所（Cloudflare）へ「保存」される送信を種類ごとに数える（2026-11-18 の書き込み上限の調査）。
// 流れ: 2台がトークを開く → 10通やり取り → 相手が画面を消す/つけるを繰り返しながら数通 → 既読から16分（時計を進める）→ そのまま置く。
// 使い方: bash tools/run_e2e.sh tools/e2e/real_use.js   （DIR_A/DIR_B で版を変えられる。IDLE_MIN=置く分）
const {chromium}=require('playwright'); const {spawn}=require('child_process'); const path=require('path');
const DIR=process.env.DIR_A||process.argv[2], DIR_B=process.env.DIR_B||DIR;
const SK=Buffer.alloc(32,7).toString('base64'),TOPIC='gskr4t-'+Date.now().toString(16).padEnd(24,'q');const PS='https://zatsugaku-push.pprnt908.workers.dev';
const MIN=+(process.env.IDLE_MIN||3), HIST=+(process.env.HIST||0);
const net={};
async function dev(b,me,peer,host,tag){ const D=tag==='B'?DIR_B:DIR; const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC})=>{ if(localStorage.getItem('mtp_pair_v1'))return; localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{me,peer,host,SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url(),m=r.request().method();
  if(u.startsWith('https://zg.test/'))return r.fulfill({path:D+'/'+(u.split('/').pop().split('?')[0]||'index.html')});
  if(u.startsWith(PS)){ const k=tag+' '+m+' '+(u.includes('/r/')?(u.includes('/json')?'poll':(u.includes('/file/')?'file':(u.includes('cache=no')?'r(流すだけ)':'r(保存)'))):u.replace(PS,'').split('?')[0]); net[k]=(net[k]||0)+1; return r.continue(); }
  if(u.startsWith('https://ntfy.sh/')){ const k=tag+' ntfy '+m; net[k]=(net[k]||0)+1; return r.continue(); }
  return r.abort();});
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(6000);
 await pg.evaluate(()=>{ window.__shift=0; const real=Date.now.bind(Date); Date.now=()=>real()+window.__shift; });
 await pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat');
   window.__byT={}; window.__opens=0; const N=__t.Net, op=N.post.bind(N), os=N.storeFetch.bind(N), on=N.onState;
   N.onState=function(s){ if(s==='open') window.__opens++; return on&&on.apply(this,arguments); };
   N.post=function(env){ window.__curT=env&&env.t; return op.apply(N,arguments); };
   N.storeFetch=function(topic,init,q){ if(init&&(init.method==='POST'||init.method==='PUT')){ const k=(window.__curT||'?')+(init.method==='PUT'?'(PUT)':((q||'').includes('cache=no')?'(流す)':'(保存)')); window.__byT[k]=(window.__byT[k]||0)+1; } return os.apply(N,arguments); };
 }); return pg;}
const vis=(p,h)=>p.evaluate(h=>{ Object.defineProperty(document,'hidden',{get:()=>h,configurable:true}); Object.defineProperty(document,'visibilityState',{get:()=>h?'hidden':'visible',configurable:true}); document.dispatchEvent(new Event('visibilitychange')); },h);
function stored(){ return Object.entries(net).filter(([k])=>k.includes('(保存)')||k.includes('PUT')).reduce((s,[,v])=>s+v,0); }
(async()=>{
 const fake=spawn('node',[path.join(__dirname,'../fake_net.js')],{stdio:['ignore','pipe','inherit']});
 await new Promise(r=>fake.stdout.on('data',d=>{ if(String(d).includes('ready')) r(); }));
 const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1, MAP ntfy.sh 127.0.0.2, MAP broker.hivemq.com 127.0.0.3, MAP broker.emqx.io 127.0.0.3','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true,'A'), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false,'B');
 await A.waitForTimeout(5000);
 const fastUp=await A.evaluate(()=>!!(__t.Fast&&__t.Fast.open)), ntfyUp=await A.evaluate(()=>!!__t.Net.open);
 console.log('即時路(MQTT)',fastUp?'つながっている':'×','／ ntfy',ntfyUp?'つながっている':'×');
 if(HIST){ for(const p of [A,B]) await p.evaluate(async n=>{ const ids=[]; for(let i=0;i<n;i++){ let h=''; for(let k=0;k<32;k++) h+='0123456789abcdef'[(Math.random()*16)|0]; ids.push('M'+h); } await __t.deletionRemember(__t.S.me.id,ids); },HIST);
   console.log('消えた記録',HIST,'件ずつ'); }
 const t0=Date.now(); const mark=[]; const lap=(name)=>{ mark.push([name,stored(),Math.round((Date.now()-t0)/1000)]); };
 for(const k in net) delete net[k]; for(const p of [A,B]) await p.evaluate(()=>{ window.__byT={}; window.__opens=0; });
 for(let i=0;i<5;i++){ await A.fill('#in-chat','A'+i); await A.click('#btn-chat-send'); await A.waitForTimeout(2000); await B.fill('#in-chat','B'+i); await B.click('#btn-chat-send'); await B.waitForTimeout(2000); }
 await A.waitForTimeout(6000); lap('10通やり取り');
 for(let i=0;i<4;i++){ await vis(B,true); await A.fill('#in-chat','A隠'+i); await A.click('#btn-chat-send'); await A.waitForTimeout(8000); await vis(B,false); await B.waitForTimeout(6000); }
 lap('相手が画面を消す/つける中に4通');
 for(const p of [A,B]) await p.evaluate(()=>{ window.__shift=16*60*1000; });
 await A.waitForTimeout(20000); lap('既読から16分（消える）');
 await A.waitForTimeout(MIN*60000); lap(MIN+'分置く');
 for(let i=0;i<3;i++){ for(const p of [A,B]) { await vis(p,true); await p.waitForTimeout(1500); await vis(p,false); } await A.waitForTimeout(20000); }
 lap('2台とも画面を3回消す/つける');
 const a=await A.evaluate(()=>[window.__byT,window.__opens]), bb=await B.evaluate(()=>[window.__byT,window.__opens]);
 console.log('A 種類ごと:',JSON.stringify(a[0]),'ntfyのopen',a[1]); console.log('B 種類ごと:',JSON.stringify(bb[0]),'ntfyのopen',bb[1]);
 console.log('通信:',JSON.stringify(net));
 let prev=0; for(const [n,v,t] of mark){ console.log(`  ${n}: 保存 ${v-prev}回（${t}秒時点で計 ${v}）`); prev=v; }
 const sec=(Date.now()-t0)/1000; console.log('合計 保存',stored(),'回 /',Math.round(sec),'秒 → 1時間あたり約',Math.round(stored()/sec*3600),'回（1回で約7行の書き込み）');
 await b.close(); fake.kill(); process.exit(0);})();
