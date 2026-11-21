// v532: 電話の記録も、トーク画面で見てから15分で消える（1台）。見ていない間は時計が始まらない。読み込み直しても時計は残る。
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+'c'.repeat(24);
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({SK,TOPIC})=>{ if(sessionStorage.getItem('i'))return; sessionStorage.setItem('i','1'); localStorage.setItem('mtp_id_v1','aaaaaaaa11'); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:1,peer:'bbbbbbbb22',peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); return r.abort();});
 const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>{ if(!/ServiceWorker/.test(e.message)) errs.push(e.message); }); await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(3500);
 const show=()=>pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 // ① トップ画面にいる間に電話の記録ができる → 時計は始まらない
 await pg.evaluate(()=>{ __t.show('home'); __t.callLogAdd('発信・応答なし'); __t.vanishSweep(); });
 const r1=await pg.evaluate(()=>{ const m=__t.S.chat.find(m=>m.callLog); return m?m.rad||0:-1; });
 console.log('① 見ていない間の時計:',r1===0?'なし':r1);
 // ② トーク画面で見る → 時計が始まる
 await show(); await pg.waitForTimeout(500); await pg.evaluate(()=>__t.vanishSweep());
 const r2=await pg.evaluate(()=>{ const m=__t.S.chat.find(m=>m.callLog); return m?m.rad||0:-1; });
 console.log('② 見た後の時計:',r2>0?'あり':'なし');
 await pg.evaluate(()=>__t.chatSaveNow()); await pg.waitForTimeout(800);
 // ③ 読み込み直しても時計が残る
 await pg.reload(); await pg.waitForTimeout(4000); await show(); await pg.waitForTimeout(500);
 const r3=await pg.evaluate(()=>{ const m=__t.S.chat.find(m=>m.callLog); return m?m.rad||0:-1; });
 console.log('③ 読み込み直した後:',r3===r2?'同じ時計':r3);
 // ④ 15分たった（時計を16分前にする）→ 消える。文字のメッセージは残る
 await pg.evaluate(()=>{ const now=Date.now(); __t.S.chat.push({uid:'t1',mid:'Mt1',from:'bbbbbbbb22',text:'のこる',at:now,sent:true,n:5}); __t.S.chat.find(m=>m.callLog).rad=now-16*60000; __t.vanishSweep(); });
 const r4=await pg.evaluate(()=>({cl:__t.S.chat.filter(m=>m.callLog).length,txt:__t.S.chat.some(m=>m.text==='のこる'),row:!!document.querySelector('#chat-log .zg-call')}));
 await pg.waitForTimeout(6000);
 const r5=await pg.evaluate(()=>!!document.querySelector('#chat-log .zg-call'));
 console.log('④ 15分後: 記録',r4.cl,'件・文字は残る',r4.txt,'・画面の行',r5?'残っている':'消えた','エラー',errs.length?errs:'なし');
 const ok=r1===0&&r2>0&&r3===r2&&r4.cl===0&&r4.txt&&!r5&&!errs.length;
 console.log(ok?'OK: 電話の記録も見てから15分で消える':'NG'); await b.close(); process.exit(ok?0:1);})();
