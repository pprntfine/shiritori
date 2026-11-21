// v529: 前の版の不具合で「送信中」のまま送信待ちから消えた自分のメッセージ（sent=false・受領なし・送信待ちに無い）が、
// 送り直されて相手に届き、「送信中…」が消える。v528 までは送り直す物が無く、相手に届かないまま止まっていた。
// 読み込み直した後（保存から戻した場合）も確かめる。
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'g');const PS='https://zatsugaku-push.pprnt908.workers.dev';
let lateUntil=0;
const https=require('https');
function local(req){ return new Promise((ok,ng)=>{ const u=new URL(req.url()); const body=req.postDataBuffer();
 const h=Object.assign({},req.headers(),{host:u.host}); delete h['content-length'];
 const q=https.request({host:'127.0.0.1',port:443,path:u.pathname+u.search,method:req.method(),headers:h,rejectUnauthorized:false,servername:u.hostname},rs=>{ const c=[]; rs.on('data',d=>c.push(d)); rs.on('end',()=>ok({status:rs.statusCode,headers:rs.headers,body:Buffer.concat(c)})); });
 q.on('error',ng); if(body) q.write(body); q.end(); }); }
async function dev(b,me,peer,host,late){const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC})=>{ if(sessionStorage.getItem('i'))return; sessionStorage.setItem('i','1'); localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{me,peer,host,SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url();
  if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')});
  if(late&&(u.startsWith(PS+'/r/'))&&r.request().method()==='POST'&&Date.now()<lateUntil){
    // 中継所には届ける（相手は受け取れる）が、こちらへの返事は12秒遅らせる（アプリは10秒で打ち切る）
    // （Playwright の r.fetch は host-resolver-rules を通らないので、手元の中継所へ自分で送る）
    let res; try{ res=await local(r.request()); }catch(e){ return r.abort(); }
    await new Promise(x=>setTimeout(x,12000)); try{ return await r.fulfill(res); }catch(e){ return; } }
  if(u.startsWith(PS))return r.continue(); return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); return {pg};}
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true,false), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false,false);
 await A.pg.waitForTimeout(8000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 await A.pg.fill('#in-chat','ならし'); await A.pg.click('#btn-chat-send'); await A.pg.waitForTimeout(4000);
 // 取り残されたメッセージを作る（画面に「送信中」の吹き出しだけあり、送信待ちには無い）
 await A.pg.evaluate(async()=>{ const S=__t.S; const mid='M'+[...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,'0')).join('');
   S.chat.push({mid,from:S.me.id,text:'取り残し',at:Date.now()-60000,sent:false,acked:false,read:false,n:0,uid:'x9'}); await __t.chatSaveNow?.(); });
 await A.pg.evaluate(()=>{ try{ __t.persistChat&&__t.persistChat(); }catch(e){} });
 await A.pg.waitForTimeout(1500);
 await A.pg.reload(); await A.pg.waitForTimeout(8000);
 await A.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 const before=await A.pg.evaluate(()=>{const m=__t.S.chat.find(m=>m.text==='取り残し'); return m?{sent:m.sent,acked:m.acked}:null;});
 console.log('読み込み直した後:',JSON.stringify(before));
 let got=false; for(let i=0;i<80&&!got;i++){ await B.pg.waitForTimeout(500); got=await B.pg.evaluate(()=>__t.S.chat.some(m=>m.text==='取り残し')); }
 console.log('相手に届いた:',got);
 await A.pg.waitForTimeout(8000);
 const st=await A.pg.evaluate(()=>{const m=__t.S.chat.find(m=>m.text==='取り残し'); const row=[...document.querySelectorAll('#chat-log .msg')].find(r=>r.textContent.includes('取り残し'));
   return {sent:m&&m.sent,acked:m&&m.acked,read:m&&m.read,meta:row?row.textContent.replace(/\s+/g,' ').slice(-40):''};});
 console.log('送った側:',JSON.stringify(st));
 const ok=!!before&&got&&!/送信中/.test(st.meta);
 console.log(ok?'OK: 取り残されたメッセージも送り直されて届く':'NG: 送信中のまま・相手に届かない');
 await b.close(); process.exit(ok?0:1);})();
