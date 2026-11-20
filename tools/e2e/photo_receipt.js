// v523: 写真を送って相手が見たら「既読」になる（持ち主: 相手が見ても送信済みのまま）。2台・中継所。
//  本物の流れ（写真選び→確認→送信）で送り、B がトークで見る → A の写真の表示が「既読」になるか。文字のメッセージと比べる。
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'e');const PS='https://zatsugaku-push.pprnt908.workers.dev';
async function dev(b,me,peer,host){const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC})=>{ if(sessionStorage.getItem('i'))return; sessionStorage.setItem('i','1'); localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{me,peer,host,SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); if(u.startsWith(PS))return r.continue(); return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); pg.on('dialog',d=>d.accept()); await pg.goto('https://zg.test/index.html'); return {pg};}
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false);
 await A.pg.waitForTimeout(9000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 await A.pg.waitForTimeout(1500);
 let all=true; const chk=(n,ok,x)=>{ console.log(n,JSON.stringify(x).slice(0,600),ok?'OK':'NG'); if(!ok) all=false; };
 const MODE=process.env.MODE||'view';
 if(MODE!=='view') await B.pg.evaluate(()=>{ __t.show('lobby'); });
 if(MODE==='hidden') await B.pg.evaluate(()=>{ Object.defineProperty(document,'visibilityState',{get:()=>window.__vis||'visible',configurable:true}); Object.defineProperty(document,'hidden',{get:()=>(window.__vis||'visible')!=='visible',configurable:true}); window.__vis='hidden'; document.dispatchEvent(new Event('visibilitychange')); });
 // 文字
 if(!process.env.NOTEXT) await A.pg.evaluate(()=>{ __t.queueChat('もじ'); });
 // 写真（本物の流れ）
 if(process.env.RETRY){
   // 1回目は届いているのに、返事が遅く「失敗」と見えた（弱い電波・30秒の打ち切り）→ 送り直しで封筒の番号が変わる。相手は1回目を受け取るのに時間がかかる（大きい写真）。
   await A.pg.evaluate(()=>{ const N=__t.Net, orig=N.sendFile.bind(N); let first=true; N.sendFile=function(h,bytes,cb){ if(first&&h&&h.t==='photo'){ first=false; const e=orig(h,bytes,function(){}); setTimeout(()=>cb(false),300); return e; } return orig(h,bytes,cb); }; });
   await B.pg.evaluate(()=>{ const N=__t.Net, orig=N.fetchFile.bind(N); let first=true; N.fetchFile=async function(a,m){ if(first){ first=false; await new Promise(r=>setTimeout(r,6000)); } return orig(a,m); }; });
 }   // 1回目は届いたのに「失敗」と見えた（弱い電波で返事が遅れた）→ 送り直し
 await A.pg.evaluate(async()=>{ const cv=document.createElement('canvas'); cv.width=1200; cv.height=1600; const x=cv.getContext('2d'); x.fillStyle='#4a8'; x.fillRect(0,0,1200,1600); x.fillStyle='#fff'; x.font='80px sans-serif'; x.fillText('写真',100,300);
   const blob=await new Promise(r=>cv.toBlob(r,'image/jpeg',0.9)); const dt=new DataTransfer(); dt.items.add(new File([blob],'IMG.jpg',{type:'image/jpeg'})); const inp=document.getElementById('zg-cam-native'); inp.files=dt.files; inp.dispatchEvent(new Event('change')); });
 if(MODE!=='view'){ await B.pg.waitForTimeout(15000); await B.pg.evaluate(()=>{ window.__vis='visible'; document.dispatchEvent(new Event('visibilitychange')); }); await B.pg.waitForTimeout(500); await B.pg.evaluate(()=>{ __t.show('play'); __t.setTab('chat'); }); }
 const st=()=>A.pg.evaluate(()=>{ const me=__t.S.me.id; return __t.S.chat.filter(m=>m.from===me&&!m.sys).map(m=>({photo:!!m.photo,mid:m.mid,pid:m.pid,n:m.n,sent:m.sent,acked:m.acked,peerAck:m.peerAck,read:m.read,meta:__t.metaText?__t.metaText(m,true,m.at,true):''})); });
 let a; for(let i=0;i<60;i++){ await A.pg.waitForTimeout(1000); a=await st(); if(a.length>=(process.env.NOTEXT?1:2)&&a.every(m=>m.read&&m.sent)) break; }
 const bs=await B.pg.evaluate(()=>{ const me=__t.S.me.id; return __t.S.chat.filter(m=>m.from!==me&&!m.sys).map(m=>({photo:!!m.photo,mid:m.mid,pid:m.pid,n:m.n,hasData:!!m.data})); });
 const t=a.find(m=>!m.photo), p=a.find(m=>m.photo);
 if(!process.env.NOTEXT) chk('文字は既読',t&&t.read,t); chk('写真は既読',p&&p.read,{A:p,B:bs});
 console.log(all?'OK: 写真も既読になる':'NG'); await b.close(); process.exit(all?0:1);})();
