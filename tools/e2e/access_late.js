// v512: アクセス履歴に、相手が開いていない時刻の記録が出る（持ち主）。1台（ホスト）・中継所なし。
// 原因: 10分より前の合図を「届いた時刻（＝自分が開いた時刻）」で記録し、そのうえ「今つながっている」にして70秒後に「接続が切れました」も記録していた。
//  ① 40分前の合図があとから届く → 40分前の時刻で記録（今の時刻ではない）・「今開いています」にならない・「接続が切れました」が付かない
//  ② 同じ開封が通知サーバー経由（po）でも届く → 2件にならない。閉じている間の別の開封（po の2件目）は、その時刻で1件
//  ③ 12時間より前・未来の合図は記録しない
// 使い方: python3 tools/make_test.py index.html /tmp/zg && node tools/e2e/access_late.js /tmp/zg
const {chromium}=require('playwright');const DIR=process.argv[2];
const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+'c'.repeat(24);
(async()=>{const b=await chromium.launch(); let all=true; const chk=(n,ok,x)=>{ console.log(n,JSON.stringify(x),ok?'OK':'NG'); if(!ok) all=false; };
 const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({SK,TOPIC})=>{ localStorage.setItem('mtp_id_v1','aaaaaaaa11'); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:1,peer:'bbbbbbbb22',peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); localStorage.removeItem('zg_peer_log'); },{SK,TOPIC});
 await ctx.route('**/*',r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); return r.abort();});
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(2500);
 const now=await pg.evaluate(()=>Date.now()); const t1=now-40*60000, t2=now-25*60000;
 const log=()=>pg.evaluate(()=>JSON.parse(localStorage.getItem('zg_peer_log')||'[]').map(e=>({k:e.k,t:e.t,p:e.p,r:e.r||''})));
 await pg.evaluate(({t1})=>{ const S=__t.S; S.isHost=true; S.linked=true; S.paired=true; S.opp={id:'bbbbbbbb22',name:'あいて'}; window.__zgsPeerLive=0; window.__zgsPeerLast=0;
   __t.peerChatOpen(t1,true,'touch',{r:'play',pv:'v511',f:'bbbbbbbb22'}); },{t1});
 await pg.waitForTimeout(6500);   /* 5秒ごとの見回り（接続が切れました の記録）を1回以上 */
 let l=await log(); const live=await pg.evaluate(()=>+(window.__zgsPeerLive||0));
 chk('①40分前の合図は40分前の時刻で・今開いているにしない・切れましたを付けない',l.length===1&&l[0].t===t1&&l[0].k==='late'&&!live&&!l.some(e=>e.k==='off'),{l,live});
 await pg.evaluate(async({t1,t2})=>{ const c=await caches.open('zg-count'); await c.put('po',new Response(t1+','+t2)); document.dispatchEvent(new Event('visibilitychange')); },{t1,t2});
 await pg.waitForTimeout(800); l=await log();
 chk('②通知サーバー経由の同じ開封は1件・別の開封はその時刻で',l.length===2&&l[0].t===t1&&l[0].p==='touch'&&l[1].t===t2&&l[1].p==='push',l);
 await pg.evaluate(({now})=>{ __t.peerChatOpen(now-13*3600e3,true,'touch',{r:'play'}); __t.peerChatOpen(now+10*60000,false,'touch',{r:'play'}); },{now});
 l=await log(); chk('③12時間より前・未来の合図は記録しない',l.length===2,l.length);
 await pg.evaluate(()=>{ __t.peerChatOpen(Date.now()-3000,false,'touch',{r:'play'}); }); l=await log(); const live2=await pg.evaluate(()=>+(window.__zgsPeerLive||0));
 chk('④今の合図はふつうに記録・今開いている',l.length===3&&(l[2].k==='late'||l[2].k==='open')&&!!live2,{n:l.length,last:l[2],live:!!live2});
 console.log(all?'OK: 相手の合図は本当の時刻で記録':'NG'); await b.close(); process.exit(all?0:1);})();
