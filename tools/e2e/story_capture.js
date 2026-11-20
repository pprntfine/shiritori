// v521: ストーリーの「＋」→ 写真を撮る・動画を撮る・写真や動画を選ぶ（1台）。
//  ① ＋ で下から選ぶ画面が出る  ② 写真を撮る＝capture つきの image/* が開く（トークを隠す処理が止まる印 __zgPicking）
//  ③ 動画を撮る＝capture つきの video/*  ④ 選ぶ＝capture なし  ⑤ キャンセルで閉じる  ⑥ 撮った写真で作る画面が開く
// 使い方: bash tools/run_e2e.sh tools/e2e/story_capture.js
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'7');
(async()=>{const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({SK,TOPIC})=>{ if(sessionStorage.getItem('i'))return; sessionStorage.setItem('i','1'); localStorage.setItem('mtp_id_v1','aaaaaaaa11'); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:1,peer:'bbbbbbbb22',peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9}));
   HTMLInputElement.prototype.click=function(){ window.__clicked=(window.__clicked||[]).concat([{id:this.id,accept:this.accept,cap:this.getAttribute('capture')}]); }; },{SK,TOPIC});
 await ctx.route('**/*',r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); return r.abort();});
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(3000);
 await pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); }); await pg.waitForTimeout(800);
 let all=true; const chk=(n,ok,x)=>{ console.log(n,JSON.stringify(x),ok?'OK':'NG'); if(!ok) all=false; };
 const tap=async k=>{ await pg.click('#zg-st-me'); await pg.waitForTimeout(200); const vis=await pg.evaluate(()=>!document.getElementById('zg-st-sheet').hidden); await pg.click('#zg-st-sheet button[data-k="'+k+'"]'); await pg.waitForTimeout(200);
   return pg.evaluate(v=>({vis:v,shut:document.getElementById('zg-st-sheet').hidden,last:(window.__clicked||[]).slice(-1)[0],n:(window.__clicked||[]).length,pick:!!window.__zgPicking}),vis); };
 await pg.click('#zg-st-me'); await pg.waitForTimeout(300); await pg.screenshot({path:'/tmp/claude-0/sc/story_sheet.png'});
 const txt=await pg.evaluate(()=>[...document.querySelectorAll('#zg-st-sheet button')].map(b=>b.textContent)); await pg.click('#zg-st-sheet button[data-k="x"]');
 chk('①＋で選ぶ画面',txt.length===4,txt);
 let r=await tap('p'); chk('②写真を撮る',r.vis&&r.shut&&r.last.id==='zg-st-camp'&&r.last.accept==='image/*'&&r.last.cap==='environment'&&r.pick,r);
 r=await tap('v'); chk('③動画を撮る',r.last.id==='zg-st-camv'&&r.last.accept==='video/*'&&r.last.cap==='environment',r);
 r=await tap('g'); chk('④選ぶ',!r.last.cap&&/image/.test(r.last.accept)&&/video/.test(r.last.accept),r);
 const n0=r.n; r=await tap('x'); chk('⑤キャンセル',r.shut&&r.n===n0,r);
 // ⑥ 撮った写真
 const png=await pg.evaluate(()=>{ const c=document.createElement('canvas'); c.width=900; c.height=1600; const x=c.getContext('2d'); x.fillStyle='#3a7'; x.fillRect(0,0,900,1600); return c.toDataURL('image/png').split(',')[1]; });
 await pg.setInputFiles('#zg-st-camp',{name:'cam.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')}); await pg.waitForTimeout(3500);
 r=await pg.evaluate(()=>({edit:!document.getElementById('zg-st-edit').hidden,play:document.body.classList.contains('in-play'),pick:window.__zgPicking}));
 await pg.screenshot({path:'/tmp/claude-0/sc/story_cap_edit.png'});
 chk('⑥撮った写真で作る画面・トークのまま・3秒後に解除',r.edit&&r.play&&!r.pick,r);
 console.log(all?'ALL OK':'SOME NG'); await b.close(); process.exit(all?0:1);})();
