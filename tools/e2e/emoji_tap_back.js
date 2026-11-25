// v546: 絵文字を入れた後に入力欄を指で押すと、絵文字が閉じて入力欄にカーソルが入る（キーボードが出る）。v545 は閉じるだけで入力欄から外れていた。1台。
// v547: ✕を押した時も入力欄に戻る。
// 使い方: node tools/e2e/emoji_tap_back.js テスト用フォルダ
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+'c'.repeat(24);
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await ctx.addInitScript(({SK,TOPIC})=>{ localStorage.setItem('mtp_id_v1','aaaaaaaa11'); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:1,peer:'bbbbbbbb22',peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); return r.abort();});
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(3500);
 await pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 await pg.waitForTimeout(600);
 await pg.tap('#in-chat'); await pg.waitForTimeout(200);
 await pg.tap('#btn-emo'); await pg.waitForTimeout(300);
 await pg.tap('#zg-emo .ze-e'); await pg.waitForTimeout(200);
 const bb=await pg.evaluate(()=>{const r=document.getElementById('in-chat').getBoundingClientRect();return [r.left+60,r.top+r.height/2];});
 await pg.touchscreen.tap(bb[0],bb[1]); await pg.waitForTimeout(300);
 const st=await pg.evaluate(()=>({open:document.getElementById('zg-emo').classList.contains('on'),focus:document.activeElement&&document.activeElement.id,v:document.getElementById('in-chat').value}));
 await pg.tap('#btn-emo'); await pg.waitForTimeout(300); await pg.tap('#zg-emo .ze-x'); await pg.waitForTimeout(300);
 const x=await pg.evaluate(()=>({open:document.getElementById('zg-emo').classList.contains('on'),focus:document.activeElement&&document.activeElement.id})); console.log('✕',JSON.stringify(x)); if(x.open||x.focus!=='in-chat') st.focus='x-NG';
 console.log(JSON.stringify(st)); console.log(st.focus==='in-chat'&&!st.open?'OK':'NG'); await b.close(); process.exit(st.focus==='in-chat'&&!st.open?0:1);})();
