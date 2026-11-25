// v541/v542: 入力欄の右端の絵文字ボタン（v542: 約700個・💦💧なども）（持ち主: 左にマイク・右に絵文字）。押すと絵文字を選ぶ画面、押した絵文字が入力欄のカーソルの所に入る・「よく使う」に残る。1台。
// v545: LINE と同じく一覧は入力欄の下（キーボードの場所）。開くと入力欄から外れる・入力欄を押すと閉じる・もう一度押すとキーボードへ。
// 使い方: node tools/e2e/emoji_input.js テスト用フォルダ
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+'c'.repeat(24);
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 await ctx.addInitScript(({SK,TOPIC})=>{ localStorage.setItem('mtp_id_v1','aaaaaaaa11'); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:1,peer:'bbbbbbbb22',peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); return r.abort();});
 const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>{ if(!/ServiceWorker/.test(e.message)) errs.push(e.message); }); await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(3500);
 await pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 await pg.waitForTimeout(600);
 await pg.fill('#in-chat','こんにちは、今日はいい天気やね。夕方から出かけるね');
 await pg.click('#btn-emo'); await pg.waitForTimeout(300);
 const open1=await pg.evaluate(()=>document.getElementById('zg-emo').classList.contains('on'));
 const below=await pg.evaluate(()=>{ const t=document.getElementById('in-chat').getBoundingClientRect(),p=document.getElementById('zg-emo').getBoundingClientRect(); return {ok:p.top>=t.bottom-1&&p.bottom<=innerHeight+1,blur:document.activeElement!==document.getElementById('in-chat'),h:Math.round(p.height),pt:Math.round(p.top),tb:Math.round(t.bottom)}; });
 await pg.screenshot({path:process.env.SHOT||'/tmp/emo545.png'});
 const tabs=await pg.evaluate(()=>[...document.querySelectorAll('#zg-emo .ze-tab')].map(t=>t.textContent)); const iSym=tabs.indexOf('ハート・記号');
 await pg.click('#zg-emo .ze-tab[data-i="'+iSym+'"]'); const syms=await pg.evaluate(()=>[...document.querySelectorAll('#zg-emo .ze-e')].map(e=>e.dataset.e));
 await pg.click('#zg-emo .ze-e[data-e="💦"]'); await pg.click('#zg-emo .ze-e[data-e="💧"]');
 const v=await pg.evaluate(()=>document.getElementById('in-chat').value);
 await pg.click('#zg-emo .ze-tab[data-i="0"]'); await pg.waitForTimeout(200);
 const rec=await pg.evaluate(()=>[...document.querySelectorAll('#zg-emo .ze-e')].map(e=>e.dataset.e));
 await pg.click('#in-chat'); await pg.waitForTimeout(200);
 const taClose=await pg.evaluate(()=>!document.getElementById('zg-emo').classList.contains('on')&&document.activeElement===document.getElementById('in-chat'));
 await pg.click('#btn-emo'); await pg.waitForTimeout(200); await pg.click('#btn-emo'); await pg.waitForTimeout(200);
 const back=await pg.evaluate(()=>!document.getElementById('zg-emo').classList.contains('on')&&document.activeElement===document.getElementById('in-chat'));
 await pg.click('#btn-emo'); await pg.waitForTimeout(200);
 console.log('下に出る',JSON.stringify(below),'・入力欄で閉じる',taClose,'・もう一度押すとキーボード',back);
 await pg.mouse.click(200,200); await pg.waitForTimeout(200); const closed=await pg.evaluate(()=>!document.getElementById('zg-emo').classList.contains('on'));
 const r=await pg.evaluate(()=>{ const g=e=>document.getElementById(e).getBoundingClientRect(); const ta=g('in-chat'),m=g('btn-mic'),e=g('btn-emo'); return {ta:[ta.left,ta.right],mic:[m.left,m.right],emo:[e.left,e.right],pl:getComputedStyle(document.getElementById('in-chat')).paddingLeft,pr:getComputedStyle(document.getElementById('in-chat')).paddingRight}; });
 console.log('入力欄の中身:',v,'・よく使う',JSON.stringify(rec),'・配置',JSON.stringify(r),'エラー',errs);
 const total=await pg.evaluate(()=>[...document.querySelectorAll('#zg-emo .ze-tab')].length);
 console.log('分類',tabs.join('・'),'・記号の数',syms.length);
 const ok=open1&&below.ok&&below.blur&&taClose&&back&&/ね💦💧$/.test(v)&&rec[0]==='💧'&&rec[1]==='💦'&&syms.length>80&&r.mic[0]-r.ta[0]<30&&r.ta[1]-r.emo[1]<30&&closed&&!errs.length;
 console.log(ok?'OK: 左にマイク・右の絵文字で入力できる':'NG'); await b.close(); process.exit(ok?0:1);})();
