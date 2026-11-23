// v536: 相手が読んだ（既読の時計が入った）のに、最初の既読が途中で消えた形。相手がトーク画面を見ている間に既読を返しなおすので、送った側に既読が付く。
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
 await B.pg.evaluate(()=>{ __t.show('home'); });   // B はトップにいて、まだ読まない
 await A.pg.fill('#in-chat','既読が消えた'); await A.pg.click('#btn-chat-send');
 let got=false; for(let i=0;i<40&&!got;i++){ await B.pg.waitForTimeout(500); got=await B.pg.evaluate(()=>__t.S.chat.some(m=>m.text==='既読が消えた')); }
 await A.pg.waitForTimeout(3000);
 // B で「読んだが既読が届かなかった」形にする: 時計を入れ、既読は送り済みの扱いにして、既読を送る関数を止めたままトーク画面へ
 await B.pg.evaluate(()=>{ const m=__t.S.chat.find(m=>m.text==='既読が消えた'); m.rad=Date.now()-60000; __t.S.readSent=__t.S.lastPeerN; const N=__t.Net, o=N.send.bind(N); window.__first=true; N.send=function(obj,cb){ if(obj&&obj.t==='read'&&window.__first&&!obj.__noStore){ window.__first=false; if(cb) cb(true); return 1; } return o(obj,cb); }; __t.show('play'); __t.setTab('chat'); });
 const st0=await A.pg.evaluate(()=>!!__t.S.chat.find(m=>m.text==='既読が消えた').read);
 let rd=false; for(let i=0;i<40&&!rd;i++){ await A.pg.waitForTimeout(500); rd=await A.pg.evaluate(()=>!!__t.S.chat.find(m=>m.text==='既読が消えた').read); }
 const meta=await A.pg.evaluate(()=>{ const m=__t.S.chat.find(m=>m.text==='既読が消えた'); const r=[...document.querySelectorAll('#chat-log .msg')].find(x=>x.textContent.includes('既読が消えた')); return r?r.textContent.replace(/\s+/g,' ').slice(-30):''; });
 console.log('B が受け取った:',got,'・最初は既読なし:',!st0,'・20秒以内に既読が付いた:',rd,'・表示:',meta,'エラー',errs.length?errs:'なし');
 const ok=got&&!st0&&rd&&!errs.length;
 console.log(ok?'OK: 既読が途中で消えても、相手が見ている間に既読が付く':'NG');
 await b.close(); process.exit(ok?0:1);})();
