// v558/v559: 送信の後、次のメッセージに「最後に入力した区間」が残る（持ち主・Android）。Android のキーボードは入力欄をプログラムで空にしても
//  打っていた区間を覚えていて、次の1文字で一緒に戻すことがある。ここでは本物のキーボードは試せないので、その動きをまねる:
//  ① 送信で入力欄が空になる ② 送った直後の最初の入力で「前の区間＋新しい文字」になったら、前の区間を取り除く
//  ③ ふつうに打った1文字・送った文の終わりと同じ言葉をあとで打った時は消さない ④ 貼り付けは見ない。
//  v559: ⑤ 前の区間だけが戻った ⑥ 1分以上たってから戻った ⑦ 何も打たないのに戻った ⑧ 絵文字ボタン・予測の言葉を押した時は消さない
//  ⑨ Android（Pixel の画面）: 送信ボタンを押しても入力欄から外れず、入力欄に入ったまま空にし、そのあとキーボードを閉じる。1台。
// 使い方: node tools/e2e/ime_residual.js テスト用フォルダ
const {chromium,devices}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+'c'.repeat(24);
async function open(b,opt){ const ctx=await b.newContext(opt);
 await ctx.addInitScript(({SK,TOPIC})=>{ localStorage.setItem('mtp_id_v1','aaaaaaaa11'); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:1,peer:'bbbbbbbb22',peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); return r.abort();});
 const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>{ if(!/ServiceWorker/.test(e.message)) errs.push(e.message); });
 await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(3500);
 await pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 return {ctx,pg,errs,cdp:await ctx.newCDPSession(pg)}; }
(async()=>{const b=await chromium.launch();
 const {pg,errs,cdp}=await open(b,{viewport:{width:390,height:844}});
 const val=()=>pg.evaluate(()=>document.getElementById('in-chat').value);
 const reset=()=>pg.evaluate(()=>{ document.getElementById('in-chat').value=''; });
 const typeAndSend=async(pre,seg)=>{ await pg.click('#in-chat'); if(pre) await pg.keyboard.insertText(pre); if(seg) await cdp.send('Input.imeSetComposition',{text:seg,selectionStart:seg.length,selectionEnd:seg.length}); await pg.click('#btn-chat-send'); await pg.waitForTimeout(400); };
 // キーボードの入力をまねる（1回の入力で値が val になる）
 const ev=(val,type,plain)=>pg.evaluate(({val,type,plain})=>{ const ta=document.getElementById('in-chat'); ta.focus(); ta.value=val; ta.dispatchEvent(plain?new Event('input',{bubbles:true}):new InputEvent('input',{bubbles:true,inputType:type,data:val})); return ta.value; },{val,type,plain});
 const comp=(v)=>ev(v,'insertCompositionText');
 const res={};
 await typeAndSend('こんにちは','げんき'); res.cleared=await val();
 res.sent=await pg.evaluate(()=>__t.S.chat.filter(c=>c.from===__t.S.me.id).map(c=>c.text));
 await comp('げんきな'); await pg.waitForTimeout(200); res.afterResidual=await val();
 // ふつう: 送った後の最初の1文字
 await reset(); await typeAndSend('またね','ばいばい'); res.normal=await comp('ま');
 // 送った文の終わりと同じ言葉を、2回目以降の入力で打った時は消さない
 await reset(); await typeAndSend('ありが','とう'); await comp('と'); res.sameWord=await comp('とうきょう');
 // 貼り付けは見ない
 await reset(); await typeAndSend('','おはよう'); res.paste=await ev('おはようございます','insertFromPaste');
 // ⑤ 前の区間だけが戻った
 await reset(); await typeAndSend('じゃあ','おやすみ'); await comp('おやすみ'); await pg.waitForTimeout(100); res.exact=await val();
 // ⑥ 送ってから時間がたってから戻った（15分前に送った扱い）
 await reset(); await typeAndSend('きょうは','たのしかった'); await pg.evaluate(()=>{ window.__zgSentGuard.at-=15*60000; }); await comp('たのしかったね'); res.late=await val();
 // ⑦ 何も打たないのに戻った（入力の合図なし）
 await reset(); await typeAndSend('あした','いく'); await pg.evaluate(()=>{ document.getElementById('in-chat').value='いく'; }); await pg.waitForTimeout(1000); res.noEvent=await val();
 // ⑧ 絵文字ボタン（アプリが入れる）・予測の言葉（キーボードの確定）は消さない
 await reset(); await typeAndSend('','やったね'); res.emoji=await ev('やったね','',true);
 await reset(); await typeAndSend('','ありがとう'); await pg.waitForTimeout(2600); res.predict=await ev('ありがとうね','insertText');
 await reset(); await typeAndSend('','うん'); await pg.waitForTimeout(2600); res.predictSame=await ev('うん','insertText');
 res.errs=errs.slice();
 // ⑨ Android
 const A=await open(b,{...devices['Pixel 7']});
 await A.pg.evaluate(()=>{ window.__log=[]; const f=document.getElementById('form-chat'); f.addEventListener('submit',()=>__log.push('submit:'+(document.activeElement&&document.activeElement.id)),true); });
 await A.pg.evaluate(()=>document.getElementById('in-chat').focus());
 await A.pg.keyboard.insertText('テスト'); await A.cdp.send('Input.imeSetComposition',{text:'げんき',selectionStart:3,selectionEnd:3});
 const sb=await A.pg.locator('#btn-chat-send').boundingBox(); await A.pg.touchscreen.tap(sb.x+sb.width/2,sb.y+sb.height/2);
 await A.pg.waitForTimeout(50); res.android=await A.pg.evaluate(()=>({log:__log,val:document.getElementById('in-chat').value,sent:__t.S.chat.filter(c=>c.from===__t.S.me.id).map(c=>c.text)}));
 await A.pg.waitForTimeout(400); res.android.after=await A.pg.evaluate(()=>document.activeElement&&document.activeElement.id);
 res.errs=res.errs.concat(A.errs);
 console.log(JSON.stringify(res));
 const ok=res.cleared===''&&res.sent[0]==='こんにちはげんき'&&res.afterResidual==='な'&&res.normal==='ま'&&res.sameWord==='とうきょう'&&res.paste==='おはようございます'
  &&res.exact===''&&res.late==='ね'&&res.noEvent===''&&res.emoji==='やったね'&&res.predict==='ありがとうね'&&res.predictSame==='うん'
  &&res.android.log[0]==='submit:in-chat'&&res.android.val===''&&res.android.sent[0]==='テストげんき'&&res.android.after!=='in-chat'&&!res.errs.length;
 console.log(ok?'OK: 前の区間・前の文が戻っても取り除く・ふつうの入力はそのまま・Android は入力欄に入ったまま空にする':'NG'); await b.close(); process.exit(ok?0:1);})();
