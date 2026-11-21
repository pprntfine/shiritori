// v527: 中継所への送信（POST）が相手に届いたのに、こちらへの返事だけが遅れて打ち切られる（弱い電波）。
// 相手は受け取って「とどいた・既読」を返す → 送信待ちから消える → 自分の送信の結果は「失敗」→ 送り直す物が無く、
// 吹き出しが「送信中…」のまま残っていた（⑯ 送信待ち 0件なのに送信中）。返事が遅いのは最初の40秒だけ。
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
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true,true), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false,false);
 await A.pg.waitForTimeout(8000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 await A.pg.fill('#in-chat','ならし'); await A.pg.click('#btn-chat-send'); await A.pg.waitForTimeout(4000);
 lateUntil=Date.now()+40000;
 await A.pg.fill('#in-chat','返事が遅い'); await A.pg.click('#btn-chat-send');
 const tl=[]; const t0=Date.now(); (async()=>{ for(let i=0;i<75;i++){ try{ const x=await A.pg.evaluate(()=>{const m=__t.S.chat.find(m=>m.text==='返事が遅い'); return JSON.stringify({s:m&&m.sent,k:m&&m.acked,ob:(__t.S.outbox||[]).length,d:window.__sendDiag||null});}); tl.push(Math.round((Date.now()-t0)/1000)+'s '+x); }catch(e){} await new Promise(r=>setTimeout(r,1000)); } })();
 let got=false; for(let i=0;i<60&&!got;i++){ await B.pg.waitForTimeout(500); got=await B.pg.evaluate(()=>__t.S.chat.some(m=>m.text==='返事が遅い')); }
 console.log('相手が受け取った:',got);
 await A.pg.waitForTimeout(70000);
 const st=await A.pg.evaluate(()=>{const m=__t.S.chat.find(m=>m.text==='返事が遅い'); const row=[...document.querySelectorAll('#chat-log .msg')].find(r=>r.textContent.includes('返事が遅い'));
   return {sent:m&&m.sent,acked:m&&m.acked,read:m&&m.read,outbox:(__t.S.outbox||[]).length,meta:row?row.textContent.replace(/\s+/g,' ').slice(-40):''};});
 console.log(tl.filter((x,i)=>i%5==0).join('\n')); console.log('送った側:',JSON.stringify(st));
 const ok=got&&!/送信中/.test(st.meta);
 console.log(ok?'OK: 相手に届いた後は「送信中」のまま残らない':'NG: 相手に届いたのに「送信中…」のまま');
 await b.close(); process.exit(ok?0:1);})();
