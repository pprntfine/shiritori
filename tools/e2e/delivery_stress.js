// 届くかの総点検: いろいろな場面で2台が送り合い、最後に「全部が1回ずつ・順番どおり届いたか」「送った側が送信済み・受領済みになったか」を数える。
// ntfy.sh・MQTT はふさぎ、中継所だけ（いちばん厳しい条件）。通信の乱れは中継所への HTTP を遅らせる・失敗させて作る。
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'s');const PS='https://zatsugaku-push.pprnt908.workers.dev';
let mode='ok'; const stat={fail:0,delay:0,req:0};
async function newCtx(b,me,peer,host){
 const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC})=>{ if(localStorage.getItem('mtp_pair_v1'))return; localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{me,peer,host,SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url();
  if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')});
  if(u.startsWith(PS)){ stat.req++;
    if(mode==='down'&&u.includes('/r/')){ stat.fail++; return r.abort(); }
    if(mode==='flaky'&&u.includes('/r/')){ const x=Math.random(); if(x<0.3){ stat.fail++; return r.abort(); } if(x<0.8){ stat.delay++; await new Promise(z=>setTimeout(z,Math.random()*7000)); } }
    return r.continue(); }
  return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 return ctx;}
async function open(ctx){ const pg=await ctx.newPage(); pg.__errs=[]; pg.on('pageerror',e=>{ if(!/ServiceWorker/.test(e.message)) pg.__errs.push(e.message); }); await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(6000);
 await pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); }); return pg; }
async function send(pg,txt){ await pg.fill('#in-chat',txt); await pg.click('#btn-chat-send'); }
async function freeze(pg,on){ const c=await pg.context().newCDPSession(pg); await c.send('Page.enable');
 if(on){ await pg.evaluate(()=>{ Object.defineProperty(document,'hidden',{get:()=>true,configurable:true}); Object.defineProperty(document,'visibilityState',{get:()=>'hidden',configurable:true}); document.dispatchEvent(new Event('visibilitychange')); }); await c.send('Page.setWebLifecycleState',{state:'frozen'}); }   // 本物のスマホはアプリを切り替えても pagehide は出さない（出すと v326 の仕様でトップに戻り、Net を閉じる）
 else { await c.send('Page.setWebLifecycleState',{state:'active'}); await pg.evaluate(()=>{ Object.defineProperty(document,'hidden',{get:()=>false,configurable:true}); Object.defineProperty(document,'visibilityState',{get:()=>'visible',configurable:true}); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); });
   await pg.waitForTimeout(500); await pg.evaluate(()=>{ if(!(__t.S.phase==='play'&&__t.S.tab==='chat')){ __t.show('play'); __t.setTab('chat'); } }); } }   // トップに戻っていたら入り直す（5回タップの代わり）
const sent={A:[],B:[]};
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const cA=await newCtx(b,'aaaaaaaa11','bbbbbbbb22',true), cB=await newCtx(b,'bbbbbbbb22','aaaaaaaa11',false);
 let A=await open(cA), B=await open(cB); await A.waitForTimeout(3000);
 const S=async(who,pg,tag)=>{ sent[who].push(tag); await send(pg,tag); };
 const log=m=>console.log(new Date().toISOString().slice(11,19),m);
 // 1) 2台が同時に連続で
 log('1 同時に連続'); for(let i=0;i<10;i++){ await Promise.all([S('A',A,'1A-'+i),S('B',B,'1B-'+i)]); }
 await A.waitForTimeout(5000);
 // 2) 相手がアプリを閉じている
 log('2 Bが閉じている'); await B.close(); for(let i=0;i<5;i++){ await S('A',A,'2A-'+i); await A.waitForTimeout(800); } await A.waitForTimeout(8000); B=await open(cB); await B.waitForTimeout(8000);
 // 3) 相手が画面を消している（止まっている）
 log('3 Bが画面を消している'); await freeze(B,true); for(let i=0;i<5;i++){ await S('A',A,'3A-'+i); await A.waitForTimeout(800); } await A.waitForTimeout(15000); await freeze(B,false); await B.waitForTimeout(8000);
 // 4) 送ってすぐ送った側が画面を消す
 log('4 Aが送ってすぐ画面を消す'); for(let i=0;i<3;i++) await S('A',A,'4A-'+i); await freeze(A,true); await B.waitForTimeout(20000); await freeze(A,false); await A.waitForTimeout(8000);
 // 5) 電波が不安定
 log('5 不安定な回線'); mode='flaky'; for(let i=0;i<10;i++){ await S('A',A,'5A-'+i); await S('B',B,'5B-'+i); await A.waitForTimeout(400); } await A.waitForTimeout(20000); mode='ok';
 // 6) 中継所への通信が15秒止まる
 log('6 中継所が15秒止まる'); mode='down'; for(let i=0;i<4;i++){ await S('A',A,'6A-'+i); await S('B',B,'6B-'+i); } await A.waitForTimeout(15000); mode='ok';
 // 最後: 2台とも開いたまま、そろうまで最大120秒待つ
 log('そろうのを待つ'); let rA,rB;
 const look=pg=>pg.evaluate(()=>{ const me=__t.S.me.id; const inn=__t.S.chat.filter(m=>!m.sys&&m.from!==me&&m.text).map(m=>({t:m.text,at:m.at})); const mine=__t.S.chat.filter(m=>!m.sys&&m.from===me&&m.text);
   return {inn, notSent:mine.filter(m=>!m.sent).map(m=>m.text), notAck:mine.filter(m=>!(m.peerAck||m.read)).map(m=>m.text), outbox:(__t.S.outbox||[]).length, warn:(()=>{const w=document.getElementById('storage-warning');return w&&!w.hidden?w.innerText.slice(0,40):'';})()}; });
 for(let i=0;i<60;i++){ rA=await look(A); rB=await look(B); if(rA.notAck.length===0&&rB.notAck.length===0&&rA.inn.length>=sent.B.length&&rB.inn.length>=sent.A.length) break; await A.waitForTimeout(2000); }
 const check=(who,got,exp)=>{ const texts=got.map(x=>x.t); const missing=exp.filter(t=>!texts.includes(t)); const dup=texts.filter((t,i)=>texts.indexOf(t)!==i);
   const order=exp.filter(t=>texts.includes(t)); const ordGot=got.slice().sort((x,y)=>x.at-y.at).map(x=>x.t).filter(t=>exp.includes(t)); const outOfOrder=order.some((t,i)=>ordGot[i]!==t);
   console.log(who+' が受け取った: '+texts.length+'/'+exp.length+'通　届かない '+missing.length+(missing.length?' '+JSON.stringify(missing):'')+'　二重 '+dup.length+'　順番ちがい '+(outOfOrder?'あり':'なし')); return missing.length+dup.length+(outOfOrder?1:0); };
 let bad=check('B（Aからの分）',rB.inn,sent.A)+check('A（Bからの分）',rA.inn,sent.B);
 for(const [w,r] of [['A',rA],['B',rB]]){ console.log(w+' の送った側の状態: 送信済みでない '+r.notSent.length+'　受領なし '+r.notAck.length+(r.notAck.length?' '+JSON.stringify(r.notAck.slice(0,8)):'')+'　送信待ち '+r.outbox+'　警告 '+(r.warn||'なし')); bad+=r.notSent.length+r.notAck.length; }
 console.log('エラー A',A.__errs.slice(0,3),'B',B.__errs.slice(0,3));
 console.log('乱れ: 中継所への通信',stat.req,'回のうち 失敗',stat.fail,'遅延',stat.delay);
 console.log(bad?('NG: 問題 '+bad+'件'):'OK: 全部1回ずつ・順番どおり届き、送った側も全部受領済み');
 await b.close(); process.exit(bad?1:0);})();
