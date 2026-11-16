const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'e');const PS='https://zatsugaku-push.pprnt908.workers.dev';
async function dev(b,me,peer,host){const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC})=>{ if(sessionStorage.getItem('i'))return; sessionStorage.setItem('i','1'); localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{me,peer,host,SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); if(u.startsWith(PS))return r.continue(); return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); return {pg};}
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false);
 await A.pg.waitForTimeout(9000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 console.log('relaySendBase A:',await A.pg.evaluate(()=>__t.relaySendBase()));
 await A.pg.evaluate(()=>{ // screenshot-like tall image with detail at top and bottom
   const c=document.createElement('canvas'); c.width=1170; c.height=2532; const x=c.getContext('2d');
   x.fillStyle='#fff'; x.fillRect(0,0,c.width,c.height);
   for(let i=0;i<300;i++){ x.fillStyle='hsl('+(i*37%360)+',70%,50%)'; x.font='40px sans-serif'; x.fillText('テキスト '+i, (i*53)%900, 60+i*8.2); }
   x.fillStyle='red'; x.fillRect(0,0,1170,80); x.fillStyle='blue'; x.fillRect(0,2452,1170,80);
   const data=c.toDataURL('image/png');
   const msg={from:__t.S.me.id,at:Date.now(),data,pid:'A'+Date.now().toString(36),uid:'9001',sent:false,n:0,photo:true};
   __t.S.chat.push(msg); __t.renderChat(true); __t.sendPhoto(msg); window.__pm=msg; });
 let r=null; for(let i=0;i<60&&!r;i++){ await B.pg.waitForTimeout(500); r=await B.pg.evaluate(()=>{ const m=__t.S.chat.find(m=>m.photo&&m.from!==__t.S.me.id); if(!m) return null; return new Promise(res=>{ const im=new Image(); im.onload=()=>{ const c=document.createElement('canvas'); c.width=im.width;c.height=im.height; const x=c.getContext('2d'); x.drawImage(im,0,0); const top=x.getImageData(5,5,1,1).data, bot=x.getImageData(5,im.height-5,1,1).data; res({w:im.width,h:im.height,chars:m.data.length,mime:m.data.slice(5,15),top:[...top].slice(0,3),bottom:[...bot].slice(0,3)}); }; im.src=m.data; }); }); }
 console.log('B got:',JSON.stringify(r));
 console.log('A meta:',await A.pg.evaluate(()=>__t.metaText(window.__pm,true,window.__pm.at,true)),'via',await A.pg.evaluate(()=>__t.Net.lastVia),'fileStatus',await A.pg.evaluate(()=>__t.Net.lastFileStatus));
 await b.close();})();
