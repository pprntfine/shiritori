// v531: 上の段の「更新」ボタン（#zg-hd-ref）を押すと、送れていない分だけその場で送り直す。送れた分は何もしない（もう一度届かない）。
// 送る側を電波なし（オフライン）にしておき（送信中のまま）、止めるのをやめた直後に文字を押して、3秒以内に送信済みになるかを見る。
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'g');const PS='https://zatsugaku-push.pprnt908.workers.dev';
let lateUntil=0; let blockA=false;
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
 const errs=[]; for(const d of [A,B]) d.pg.on('pageerror',e=>{ if(!/ServiceWorker/.test(String(e))) errs.push(String(e)); });
 await A.pg.waitForTimeout(8000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 await A.pg.fill('#in-chat','ならし'); await A.pg.click('#btn-chat-send'); await A.pg.waitForTimeout(4000);
 blockA=true; await A.pg.context().setOffline(true);
 await A.pg.fill('#in-chat','手で送り直す'); await A.pg.click('#btn-chat-send');
 await A.pg.waitForTimeout(6000);
 const mid=await A.pg.evaluate(()=>{const m=__t.S.chat.find(m=>m.text==='手で送り直す'); return {sent:m.sent,uid:m.uid};});
 console.log('止めている間:',JSON.stringify(mid));
 blockA=false; await A.pg.context().setOffline(false); await A.pg.waitForTimeout(300);
 // 自動の送り直しを待たずに、すぐ押す
 await A.pg.evaluate(()=>{ __t.S.outbox.forEach(it=>{ it.lastTry=Date.now(); }); });
 const meta=A.pg.locator('#chat-log .msg[data-uid="'+mid.uid+'"] .meta'); console.log('押す前の表示:',(await meta.textContent()).replace(/\s+/g,' '));
 await A.pg.locator('#zg-hd-ref').click({force:true});
 let t=null; for(let i=0;i<12&&t===null;i++){ await A.pg.waitForTimeout(250); if(await A.pg.evaluate(()=>__t.S.chat.find(m=>m.text==='手で送り直す').sent===true)) t=(i+1)*250; }
 console.log('押してから送信済みまで:',t===null?'3秒以上':t+'ms');
 let got=false; for(let i=0;i<40&&!got;i++){ await B.pg.waitForTimeout(250); got=await B.pg.evaluate(()=>__t.S.chat.some(m=>m.text==='手で送り直す')); }
 console.log('相手に届いた:',got);
 await B.pg.waitForTimeout(3000);
 const cnt=await B.pg.evaluate(()=>({a:__t.S.chat.filter(m=>m.text==='ならし').length,b:__t.S.chat.filter(m=>m.text==='手で送り直す').length}));
 console.log('相手の画面の数（2通とも1つずつのはず）:',JSON.stringify(cnt));
 await B.pg.locator('#zg-hd-ref').click({force:true}); await B.pg.waitForTimeout(1500);
 const tst=await B.pg.evaluate(()=>{ const t=document.getElementById('toast'); return t?t.textContent:''; });
 console.log('相手が更新を押した時:',tst,'エラー:',errs.length?errs:'なし');
 const ok=mid.sent===false&&t!==null&&got&&cnt.a===1&&cnt.b===1&&/確かめています/.test(tst)&&!errs.length;
 console.log(ok?'OK: 更新で送れていない分だけ送れる・二重にならない':'NG');
 await b.close(); process.exit(ok?0:1);})();
