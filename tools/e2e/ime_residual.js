// v558: 送信の後、次のメッセージに「最後に入力した区間」が残る（持ち主・Android）。Android のキーボードは入力欄をプログラムで空にしても
//  打っていた区間を覚えていて、次の1文字で一緒に戻すことがある。ここでは本物のキーボードは試せないので、その動きをまねる:
//  ① 送信で入力欄が空になる ② 送った直後の最初の入力で「前の区間＋新しい文字」になったら、前の区間を取り除く
//  ③ ふつうに打った1文字・送った文の終わりと同じ言葉をあとで打った時は消さない ④ 貼り付けは見ない。1台。
// 使い方: node tools/e2e/ime_residual.js テスト用フォルダ
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+'c'.repeat(24);
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({SK,TOPIC})=>{ localStorage.setItem('mtp_id_v1','aaaaaaaa11'); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:1,peer:'bbbbbbbb22',peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); return r.abort();});
 const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>{ if(!/ServiceWorker/.test(e.message)) errs.push(e.message); });
 await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(3500);
 await pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 const cdp=await ctx.newCDPSession(pg);
 const typeAndSend=async(pre,seg)=>{ await pg.click('#in-chat'); if(pre) await pg.keyboard.insertText(pre); await cdp.send('Input.imeSetComposition',{text:seg,selectionStart:seg.length,selectionEnd:seg.length}); await pg.click('#btn-chat-send'); await pg.waitForTimeout(400); };
 // キーボードが前の区間を戻した時の入力（1回の入力で「前の区間＋新しい文字」になる）
 const imeReinsert=(val)=>pg.evaluate((val)=>{ const ta=document.getElementById('in-chat'); ta.focus(); ta.value=val; ta.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertCompositionText',data:val})); return ta.value; },val);
 const plainKey=(val)=>pg.evaluate((val)=>{ const ta=document.getElementById('in-chat'); ta.focus(); ta.value=val; ta.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertCompositionText',data:val})); return ta.value; },val);
 const res={};
 await typeAndSend('こんにちは','げんき'); res.cleared=await pg.evaluate(()=>document.getElementById('in-chat').value);
 res.sent=await pg.evaluate(()=>__t.S.chat.filter(c=>c.from===__t.S.me.id).map(c=>c.text));
 res.residual=await imeReinsert('げんきな'); await pg.waitForTimeout(200); res.afterResidual=await pg.evaluate(()=>document.getElementById('in-chat').value);
 // ふつう: 送った後の最初の1文字
 await pg.evaluate(()=>{ document.getElementById('in-chat').value=''; });
 await typeAndSend('またね','ばいばい'); res.normal=await plainKey('ま');
 // 送った文の終わりと同じ言葉を、2回目以降の入力で打った時は消さない
 await pg.evaluate(()=>{ document.getElementById('in-chat').value=''; });
 await typeAndSend('ありが','とう'); await plainKey('と'); res.sameWord=await plainKey('とうきょう');
 // 貼り付けは見ない
 await pg.evaluate(()=>{ document.getElementById('in-chat').value=''; });
 await typeAndSend('','おはよう'); res.paste=await pg.evaluate(()=>{ const ta=document.getElementById('in-chat'); ta.value='おはようございます'; ta.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertFromPaste'})); return ta.value; });
 res.errs=errs; console.log(JSON.stringify(res));
 const ok=res.cleared===''&&res.sent[0]==='こんにちはげんき'&&res.afterResidual==='な'&&res.normal==='ま'&&res.sameWord==='とうきょう'&&res.paste==='おはようございます'&&!errs.length;
 console.log(ok?'OK: 前の区間が戻っても取り除く・ふつうの入力はそのまま':'NG'); await b.close(); process.exit(ok?0:1);})();
