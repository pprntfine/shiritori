// 長い使い方（約35分）で、場面ごとに中継所（Cloudflare）へ「保存」される送信を種類ごとに数える。本物に近い回線（にせ ntfy・にせ MQTT）。
// 場面: 会話10通 → 写真1枚 → 相手が閉じている間に3通（8分）→ 相手が開く → 2台とも開いたまま何もしない（8分）→ 既読から16分で消える → 2台とも閉じる（夜、8分）。
// 使い方: bash tools/run_e2e.sh tools/e2e/long_use.js   （DIR_A/DIR_B で版を変えられる。PHASE_MIN=8）
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

const PM=+(process.env.PHASE_MIN||8);
async function freeze(p,on){ if(!p.__cdp){ p.__cdp=await p.context().newCDPSession(p); await p.__cdp.send('Page.enable'); }
  if(on){ await vis(p,true); await p.waitForTimeout(300); await p.__cdp.send('Page.setWebLifecycleState',{state:'frozen'}); }
  else { await p.__cdp.send('Page.setWebLifecycleState',{state:'active'}); await vis(p,false); } }
const byType=async()=>{ const o={}; for(const [n,p] of [['A',A],['B',B]]) o[n]=await p.evaluate(()=>{ const r=window.__byT; window.__byT={}; return r; }); return o; };
let A,B;
(async()=>{
 const fake=spawn('node',[path.join(__dirname,'../fake_net.js')],{stdio:['ignore','pipe','inherit']});
 await new Promise(r=>fake.stdout.on('data',d=>{ if(String(d).includes('ready')) r(); }));
 const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1, MAP ntfy.sh 127.0.0.2, MAP broker.hivemq.com 127.0.0.3, MAP broker.emqx.io 127.0.0.3','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true,'A'); B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false,'B');
 await A.waitForTimeout(5000);
 console.log('即時路(MQTT)',await A.evaluate(()=>!!__t.Fast.open)?'○':'×','ntfy',await A.evaluate(()=>!!__t.Net.open)?'○':'×');
 for(const k in net) delete net[k]; await byType();
 const rows=[]; let t=Date.now(), last=0;
 const lap=async(name)=>{ const now=Date.now(), st=stored(); const ty=await byType(); rows.push({name,sec:Math.round((now-t)/1000),n:st-last,ty}); last=st; t=now; console.log(`[${name}] ${Math.round(rows[rows.length-1].sec)}秒 保存${rows[rows.length-1].n}回 A=${JSON.stringify(ty.A)} B=${JSON.stringify(ty.B)}`); };
 for(let i=0;i<5;i++){ await A.fill('#in-chat','A'+i); await A.click('#btn-chat-send'); await A.waitForTimeout(2500); await B.fill('#in-chat','B'+i); await B.click('#btn-chat-send'); await B.waitForTimeout(2500); }
 await A.waitForTimeout(8000); await lap('会話10通');
 await A.evaluate(()=>{ const W=1170,H=2532,c=document.createElement('canvas'); c.width=W;c.height=H; const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,W,H); for(let i=0;i<200;i++){ x.fillStyle='hsl('+(i*37%360)+',70%,50%)'; x.font='40px sans-serif'; x.fillText('写真 '+i,(i*53)%900,60+i*12); }
   const msg={from:__t.S.me.id,at:Date.now(),data:c.toDataURL('image/png'),pid:'A'+Date.now().toString(36),uid:String(9000+((Math.random()*999)|0)),sent:false,n:0,photo:true}; __t.S.chat.push(msg); __t.renderChat(true); __t.sendPhoto(msg); });
 await A.waitForTimeout(60000); const got=await B.evaluate(()=>__t.S.chat.filter(m=>m.photo&&m.data).length); await lap('写真1枚（届いた'+got+'）');
 await freeze(B,true);
 for(let i=0;i<3;i++){ await A.fill('#in-chat','留守'+i); await A.click('#btn-chat-send'); await A.waitForTimeout(5000); }
 await A.waitForTimeout(PM*60000-15000); await lap('相手が閉じている間に3通（'+PM+'分）');
 await freeze(B,false); await B.evaluate(()=>{ __t.show('play'); __t.setTab('chat'); }); await B.waitForTimeout(120000);
 const gotB=await B.evaluate(()=>__t.S.chat.filter(m=>m.text&&/^留守/.test(m.text)).length); await lap('相手が開く（2分、留守の3通のうち届いた'+gotB+'）');
 await A.waitForTimeout(PM*60000); await lap('2台とも開いたまま何もしない（'+PM+'分）');
 for(const p of [A,B]) await p.evaluate(()=>{ window.__shift=16*60*1000; }); await A.waitForTimeout(60000); await lap('既読から16分で消える（1分）');
 await A.waitForTimeout(3*60000); await lap('消えた後（3分）');
 await freeze(A,true); await freeze(B,true); await A.waitForTimeout(100); await new Promise(r=>setTimeout(r,PM*60000));
 await freeze(A,false); await freeze(B,false); await lap('2台とも閉じている（夜、'+PM+'分）');
 await A.waitForTimeout(60000); await lap('朝に2台とも開く（1分）');
 console.log('---- まとめ'); let tot=0,ts=0; for(const r of rows){ tot+=r.n; ts+=r.sec; console.log(`${r.name}: 保存 ${r.n}回（1時間あたり約${Math.round(r.n/r.sec*3600)}回）`); }
 console.log('合計',tot,'回 /',Math.round(ts/60),'分。通信:',JSON.stringify(net));
 await b.close(); fake.kill(); process.exit(0);})();
