// 使い方: THR=6 NPH=10 bash tools/run_e2e.sh tools/e2e/typing_prof.js （THR=CPUを遅くする倍率、NPH=写真の枚数）
// 文字入力中の「固まり」を測る: 2台・中継所つき。A に写真とメッセージを貯め、文字を打ち続ける間の長い処理(50ms超)と、CPUを使った関数を記録。
const {chromium}=require('playwright');
const DIR=process.argv[2], OUT=process.argv[3]||'/tmp';const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'b');const PS='https://zatsugaku-push.pprnt908.workers.dev';
async function dev(b,me,peer,host){const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC})=>{ if(sessionStorage.getItem('i'))return; sessionStorage.setItem('i','1'); localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{me,peer,host,SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); if(u.startsWith(PS))return r.continue(); return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); return {pg,ctx};}
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false);
 await A.pg.waitForTimeout(8000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 const NPH=+(process.env.NPH||6);
 await A.pg.evaluate((NPH)=>{ // 写真 NPH 枚（長辺2000相当・約70万字）と 120通
   const S=__t.S; const now=Date.now()-3600e3;
   for(let i=0;i<120;i++) S.chat.push({from:i%2?S.me.id:S.opp.id,text:'メッセージ '+i+' です。今日はいい天気ですね。',at:now+i*20000,n:1000+i,sent:true,acked:true,mid:'m'+i+'x'+Math.random().toString(36).slice(2,8),uid:String(5000+i)});
   for(let k=0;k<NPH;k++){ const c=document.createElement('canvas'); c.width=1500; c.height=2000; const x=c.getContext('2d'); const id=x.createImageData(1500,2000); for(let i=0;i<id.data.length;i+=4){ const v=(Math.random()*255)|0; id.data[i]=v; id.data[i+1]=(v*7)&255; id.data[i+2]=(v*3)&255; id.data[i+3]=255; } x.putImageData(id,0,0);
     let q=0.6, d=c.toDataURL('image/webp',q); while(d.length>720000&&q>0.1){ q-=0.1; d=c.toDataURL('image/webp',q); }
     S.chat.push({from:k%2?S.me.id:S.opp.id,photo:true,pid:'P'+k,data:d,at:now+3000e3+k*1000,n:2000+k,sent:true,acked:true,uid:String(7000+k),mid:'p'+k+'x'}); }
   __t.renderChat(true); return __t.chatSaveNow().then(()=>S.chat.length); },NPH);
 await A.pg.waitForTimeout(3000);
 // 長い処理の見張り
 await A.pg.evaluate(()=>{ window.__long=[]; new PerformanceObserver(l=>{ for(const e of l.getEntries()) window.__long.push({t:Math.round(e.startTime),d:Math.round(e.duration)}); }).observe({type:'longtask',buffered:false}); });
 const cdp=await A.ctx.newCDPSession(A.pg); await cdp.send('Emulation.setCPUThrottlingRate',{rate:+(process.env.THR||1)}); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval',{interval:500}); await cdp.send('Profiler.start'); const pnow0=await A.pg.evaluate(()=>performance.now());
 await A.pg.click('#in-chat');
 const t0=Date.now(); let typed=0;
 // 40秒、文字を打つ。途中で相手から 5秒ごとにメッセージ
 const peerTalk=(async()=>{ for(let i=0;i<7;i++){ await B.pg.waitForTimeout(5000); await B.pg.fill('#in-chat','相手から '+i); await B.pg.click('#btn-chat-send'); } })();
 const keyLag=[];
 while(Date.now()-t0<40000){ const s=Date.now(); await A.pg.keyboard.type('あ'); const lag=await A.pg.evaluate(()=>new Promise(r=>{ const s=performance.now(); requestAnimationFrame(()=>r(Math.round(performance.now()-s))); })); keyLag.push(lag); typed++; await A.pg.waitForTimeout(120); }
 await peerTalk;
 const {profile}=await cdp.send('Profiler.stop');
 const longs=await A.pg.evaluate(()=>window.__long);
 // 関数ごとの自分の時間
 const self=new Map(), byId=new Map(profile.nodes.map(n=>[n.id,n])); const dt=profile.timeDeltas; const cnt=new Map();
 profile.samples.forEach((id,i)=>{ cnt.set(id,(cnt.get(id)||0)+(dt[i]||0)); });
 for(const [id,us] of cnt){ const n=byId.get(id); const f=n.callFrame; const k=(f.functionName||'(無名)')+' :'+(f.lineNumber+1); self.set(k,(self.get(k)||0)+us); }
 const top=[...self].filter(([k])=>!/^\((idle|program|garbage collector)\)/.test(k)).sort((a,b)=>b[1]-a[1]).slice(0,25).map(([k,v])=>[k,Math.round(v/1000)+'ms']);
 const gc=[...self].filter(([k])=>/garbage/.test(k)).map(([k,v])=>[k,Math.round(v/1000)+'ms']);
 // 長い処理の時に動いていた関数（包含）: サンプル時刻で
 let t=profile.startTime; const times=profile.samples.map((id,i)=>{ t+=dt[i]; return [t,id]; });
 const parent=new Map(); profile.nodes.forEach(n=>(n.children||[]).forEach(c=>parent.set(c,n.id)));
 
 const incl=new Map();
 for(const L of longs){ const s=profile.startTime+(L.t-pnow0)*1000-20000, e=s+L.d*1000+40000; const seen=new Map(); for(const [ts,id] of times){ if(ts<s||ts>e) continue; let x=id; const names=new Set(); while(x){ const f=byId.get(x).callFrame; names.add((f.functionName||'(無名)')+' :'+(f.lineNumber+1)); x=parent.get(x); } for(const nm of names) seen.set(nm,(seen.get(nm)||0)+1); } L.top=[...seen].filter(([k])=>!/^\((root|program|idle)\)/.test(k)).sort((a,b)=>b[1]-a[1]).slice(0,8).map(x=>x[0]); }
 keyLag.sort((a,b)=>a-b);
 console.log(JSON.stringify({photos:NPH,typed,keyLag:{median:keyLag[keyLag.length>>1],p95:keyLag[Math.floor(keyLag.length*0.95)],max:keyLag[keyLag.length-1]},longCount:longs.length,longTotal:longs.reduce((a,x)=>a+x.d,0),worst:longs.sort((a,b)=>b.d-a.d).slice(0,8)},null,1));
 console.log('CPU上位(自分の時間):'); top.forEach(x=>console.log('  ',x.join('  '))); console.log('GC',JSON.stringify(gc));
 await b.close();})();
