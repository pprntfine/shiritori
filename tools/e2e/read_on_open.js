// v535: 相手（B）がトップ画面にいる間にメッセージを受け取り、あとでトーク画面を開いたら、送った側（A）に「既読」が付く。
// v534 までは、受け取った時にトーク画面でなければ既読を送らず、あとでトーク画面を開いても送らなかった（「送信済み（未確認）」のまま）。
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'g');const PS='https://zatsugaku-push.pprnt908.workers.dev';
let lateUntil=0; let blockA=false;
const https=require('https');
function local(req){ return new Promise((ok,ng)=>{ const u=new URL(req.url()); const body=req.postDataBuffer();
 const h=Object.assign({},req.headers(),{host:u.host}); delete h['content-length'];
 const q=https.request({host:'127.0.0.1',port:443,path:u.pathname+u.search,method:req.method(),headers:h,rejectUnauthorized:false,servername:u.hostname},rs=>{ const c=[]; rs.on('data',d=>c.push(d)); rs.on('end',()=>ok({status:rs.statusCode,headers:rs.headers,body:Buffer.concat(c)})); });
 q.on('error',ng); if(body) q.write(body); q.end(); }); }
const CLOSED=!!process.env.CLOSED;
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
 const errs=[]; for(const d of [A,B]) d.pg.on('pageerror',e=>{ if(!/ServiceWorker/.test(String(e))) errs.push(String(e)); });
 await A.pg.waitForTimeout(8000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 await A.pg.evaluate(()=>{ window.__rr=[]; const N=__t.Net, h=N.handleEvent; });
 await A.pg.fill('#in-chat','ならし'); await A.pg.click('#btn-chat-send'); await A.pg.waitForTimeout(5000);
 // B はトップ画面へ（CLOSED=1: B はアプリを閉じていて、送った後で開く＝トップから始まる）
 let Bp=B.pg; const Bctx=B.pg.context();
 if(CLOSED){ await B.pg.close(); await A.pg.waitForTimeout(3000); }
 else { await B.pg.evaluate(()=>{ __t.show('home'); }); await A.pg.waitForTimeout(1500); }
 await A.pg.fill('#in-chat','トップにいる間に届く'); await A.pg.click('#btn-chat-send');
 if(CLOSED){ await A.pg.waitForTimeout(8000); Bp=await Bctx.newPage(); Bp.on('pageerror',e=>{ if(!/ServiceWorker/.test(String(e))) errs.push(String(e)); }); await Bp.goto('https://zg.test/index.html'); await Bp.waitForTimeout(6000); await Bp.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; }); B.pg=Bp; }
 let got=false; for(let i=0;i<40&&!got;i++){ await B.pg.waitForTimeout(500); got=await B.pg.evaluate(()=>__t.S.chat.some(m=>m.text==='トップにいる間に届く')); }
 await A.pg.waitForTimeout(4000);
 const st1=await A.pg.evaluate(()=>{const m=__t.S.chat.find(m=>m.text==='トップにいる間に届く'); return {acked:!!m.acked,read:!!m.read};});
 console.log('B が受け取った:',got,'・トップにいる間の A の表示:',JSON.stringify(st1));
 console.log('B の状態:',JSON.stringify(await B.pg.evaluate(()=>{ const m=__t.S.chat.find(m=>m.text==='トップにいる間に届く'); return {lastPeerN:__t.S.lastPeerN,readSent:__t.S.readSent,n:m&&m.n,from:m&&m.from,durable:m&&m.__durable}; })));
 // B がトーク画面を開く
 await B.pg.evaluate(()=>{ __t.show('play'); __t.setTab('chat'); });
 await B.pg.evaluate(()=>{ window.__rs=[]; const N=__t.Net, o=N.send.bind(N); N.send=function(obj,cb){ if(obj&&obj.t==='read'){ const rec={at:Date.now(),ns:(obj.ns||[]).length,rb:__t.relayAnyBase(),fast:__t.Fast.open}; window.__rs.push(rec); return o(obj,function(ok){ rec.ok=ok; if(cb) cb(ok); }); } return o(obj,cb); }; });
 let rd=false; for(let i=0;i<30&&!rd;i++){ await A.pg.waitForTimeout(500); rd=await A.pg.evaluate(()=>!!__t.S.chat.find(m=>m.text==='トップにいる間に届く').read); }
 console.log('B が送った既読の回数:',await B.pg.evaluate(()=>window.__rs.length));
 console.log('A の状態:',JSON.stringify(await A.pg.evaluate(()=>{ const m=__t.S.chat.find(m=>m.text==='トップにいる間に届く'); return {n:m.n,oldN:m.oldN,mid:m.mid,acked:m.acked,read:m.read,sent:m.sent,outbox:__t.S.outbox.length}; })));
 console.log('B が持つ mid:',await B.pg.evaluate(()=>{ const m=__t.S.chat.find(m=>m.text==='トップにいる間に届く'); return m.mid; }));
 console.log('B がトーク画面を開いた後、A に既読が付いた:',rd,'エラー',errs.length?errs:'なし');
 const ok=got&&!st1.read&&rd&&!errs.length;
 console.log(ok?'OK: あとでトーク画面を開いても既読が付く':'NG: トーク画面を開いても既読が付かない');
 await b.close(); process.exit(ok?0:1);})();
