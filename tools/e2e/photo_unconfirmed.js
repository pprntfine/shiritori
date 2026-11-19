// v503: 「相手も中継所を使える」の確認（zg_peer_relay）が消えていても、写真はきれいな大きさ（長辺2000）で届く（v502 までは長辺800・約1万2千字の粗い写真になった）。
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'a');const PS='https://zatsugaku-push.pprnt908.workers.dev';
async function dev(b,me,peer,host){const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC})=>{ if(sessionStorage.getItem('i'))return; sessionStorage.setItem('i','1'); localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{me,peer,host,SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); if(u.startsWith(PS))return r.continue(); return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); return {pg};}
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false);
 await A.pg.waitForTimeout(9000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 let allOk=true;
 await A.pg.evaluate(()=>{ localStorage.removeItem('zg_peer_relay'); });   // 相手の確認が消えた状態
 console.log('relaySendBase A:',JSON.stringify(await A.pg.evaluate(()=>__t.relaySendBase())));
 for(const [name,W,H,noisy] of [['縦長スクショ',1170,2532,false],['重いカメラ写真',3024,4032,true]]){
  const pid=await A.pg.evaluate(({W,H,noisy})=>{
   const c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d');
   if(noisy){ const g=x.createLinearGradient(0,0,W,H); g.addColorStop(0,'#8a6'); g.addColorStop(1,'#468'); x.fillStyle=g; x.fillRect(0,0,W,H);
     const id=x.getImageData(0,0,W,H), d=id.data; for(let i=0;i<d.length;i+=4){ const n=(Math.random()*90-45)|0; d[i]+=n; d[i+1]+=n; d[i+2]+=n; } x.putImageData(id,0,0); }
   else { x.fillStyle='#fff'; x.fillRect(0,0,W,H); for(let i=0;i<300;i++){ x.fillStyle='hsl('+(i*37%360)+',70%,50%)'; x.font='40px sans-serif'; x.fillText('テキスト '+i,(i*53)%900,60+i*8.2); } }
   x.fillStyle='red'; x.fillRect(0,0,W,Math.round(H*0.03)); x.fillStyle='blue'; x.fillRect(0,H-Math.round(H*0.03),W,Math.round(H*0.03));
   const data=c.toDataURL(noisy?'image/jpeg':'image/png',noisy?0.95:undefined);
   const pid='A'+Date.now().toString(36);
   const msg={from:__t.S.me.id,at:Date.now(),data,pid,uid:String(9000+((Math.random()*999)|0)),sent:false,n:0,photo:true};
   window.__t0=performance.now(); window.__pm=msg; __t.S.chat.push(msg); __t.renderChat(true); __t.sendPhoto(msg); return pid; },{W,H,noisy});
  let sentMs=null; for(let i=0;i<120&&sentMs===null;i++){ await A.pg.waitForTimeout(250); sentMs=await A.pg.evaluate(()=>window.__pm.sent?Math.round(performance.now()-window.__t0):null); }
  let r=null; for(let i=0;i<80&&!r;i++){ await B.pg.waitForTimeout(500); r=await B.pg.evaluate((pid)=>{ const m=__t.S.chat.find(m=>m.photo&&m.from!==__t.S.me.id&&m.pid===pid); if(!m||!m.data) return null; return new Promise(res=>{ const im=new Image(); im.onload=()=>{ const c=document.createElement('canvas'); c.width=im.width;c.height=im.height; const x=c.getContext('2d'); x.drawImage(im,0,0); const top=x.getImageData(5,5,1,1).data, bot=x.getImageData(5,im.height-5,1,1).data; res({w:im.width,h:im.height,chars:m.data.length,mime:m.data.slice(5,15),top:[...top].slice(0,3),bottom:[...bot].slice(0,3)}); }; im.src=m.data; }); },pid); }
  const via=await A.pg.evaluate(()=>[__t.Net.lastVia,__t.Net.lastFileStatus]);
  const ok=!!r&&Math.max(r.w,r.h)>=2500&&r.chars<=2650000&&r.top[0]>200&&r.bottom[2]>200&&via[1]===200;
  allOk=allOk&&ok;
  console.log(name,'送信('+W+'×'+H+'):', 'Bに届いた',JSON.stringify(r),'送り終わり',sentMs,'ms','経路',via.join(' '),ok?'OK':'NG');
 }
 console.log(allOk?'OK: 確認が消えていても長辺2000で届く':'NG');
 await b.close(); process.exit(allOk?0:1);})();
