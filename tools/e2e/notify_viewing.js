// v520: トーク画面を見ている時もメッセージの通知を出す（持ち主）。2台・中継所あり。B がトークを見ている → A が送る → B に通知（tag mtp-chat-live）。B がトップの時は今までどおり mtp-chat。
// v524: 画面の通知は sw.js の通知と重ならないよう5秒待ってから出すので、6秒待って数える
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'7');const PS='https://zatsugaku-push.pprnt908.workers.dev';
async function dev(b,me,peer,host,pre){const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC,pre})=>{  if(sessionStorage.getItem('i'))return; sessionStorage.setItem('i','1'); localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); for(const k in pre) localStorage.setItem(k,pre[k]); },{me,peer,host,SK,TOPIC,pre:pre||{}});
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); if(u.startsWith(PS))return r.continue(); return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); return {pg,ctx};}
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true,{}), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false,{}); let all=true;
 await A.pg.waitForTimeout(9000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 await A.pg.waitForTimeout(1500);
 await B.pg.evaluate(()=>{ window.__notes=[]; try{ Object.defineProperty(Notification,'permission',{get:()=>'granted'}); ServiceWorkerRegistration.prototype.showNotification=function(t,o){ window.__notes.push({t:o&&o.tag,at:Date.now()}); return Promise.resolve(); }; ServiceWorkerRegistration.prototype.getNotifications=function(){ return Promise.resolve([]); }; const N0=window.Notification; window.Notification=function(t,o){ window.__notes.push({t:o&&o.tag,at:Date.now()}); this.close=function(){}; }; Object.defineProperty(window.Notification,'permission',{get:()=>'granted'}); window.Notification.requestPermission=()=>Promise.resolve('granted'); }catch(e){}  });
 const send=async(t)=>{ await A.pg.evaluate((t)=>__t.queueChat(t),t); };
 const wait=async(t)=>{ for(let i=0;i<100;i++){ const ok=await B.pg.evaluate((t)=>__t.S.chat.some(m=>m.text===t),t); if(ok) break; await B.pg.waitForTimeout(300); } await B.pg.waitForTimeout(6000); return B.pg.evaluate(()=>window.__notes.map(n=>n.t)); };
 await send('見ている時'); let n1=await wait('見ている時');
 const ok1=n1.includes('mtp-chat-live'); console.log('①トークを見ている時も通知',JSON.stringify(n1),ok1?'OK':'NG'); all=all&&ok1;
 await B.pg.evaluate(()=>{ window.__notes=[]; __t.show('lobby'); });
 await send('トップの時'); let n2=await wait('トップの時');
 const ok2=n2.includes('mtp-chat')&&!n2.includes('mtp-chat-live'); console.log('②トップの時は今までどおり',JSON.stringify(n2),ok2?'OK':'NG'); all=all&&ok2;
 console.log(all?'OK: 見ている時も通知':'NG'); await b.close(); process.exit(all?0:1);})();
