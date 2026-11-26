// v552: 入力中にホーム画面に戻ってスマホがアプリを読み込み直しても、入力中の文が残る（持ち主: 消える）。1台。
//  ① 裏に回る→戻る（今までどおり残る） ② 裏に回った後に読み込み直す→残る ③ 端末の保存は暗号化（平文が無い） ④ 送ったら消え、読み込み直しても空
// 使い方: node tools/e2e/draft_keep.js テスト用フォルダ
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+'c'.repeat(24);
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({SK,TOPIC})=>{ if(!localStorage.getItem('mtp_id_v1')){ localStorage.setItem('mtp_id_v1','aaaaaaaa11'); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:1,peer:'bbbbbbbb22',peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); }
  window.__vis='visible'; Object.defineProperty(document,'visibilityState',{get:()=>window.__vis,configurable:true}); Object.defineProperty(document,'hidden',{get:()=>window.__vis!=='visible',configurable:true}); },{SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); return r.abort();});
 const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>{ if(!/ServiceWorker/.test(e.message)) errs.push(e.message); });
 await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(3500);
 const open=async()=>{ await pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); }); await pg.waitForTimeout(300); };
 const val=()=>pg.evaluate(()=>document.getElementById('in-chat').value);
 const bg=async()=>{ await pg.evaluate(()=>{ window.dispatchEvent(new Event('blur')); window.__vis='hidden'; document.dispatchEvent(new Event('visibilitychange')); }); await pg.waitForTimeout(600); };
 await open(); await pg.click('#in-chat'); await pg.keyboard.type('書きかけのメッセージ💦');
 await bg(); await pg.evaluate(()=>{ window.__vis='visible'; document.dispatchEvent(new Event('visibilitychange')); }); await pg.waitForTimeout(500);
 await open(); const r1=await val();
 await bg(); await pg.reload(); await pg.waitForTimeout(3500); await open(); const r2=await val();
 const stored=await pg.evaluate(()=>localStorage.getItem('zg_draft1')||'');
 const plain=await pg.evaluate(()=>{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(/書きかけ/.test(localStorage.getItem(k)||'')) return k; } return false; });
 await pg.click('#btn-chat-send'); await pg.waitForTimeout(1500); const r3=await val();
 const after=await pg.evaluate(()=>localStorage.getItem('zg_draft1'));
 await pg.reload(); await pg.waitForTimeout(3500); await open(); const r4=await val();
 const res={backFromHome:r1,afterReload:r2,stored:!!stored,plain,afterSend:r3,keyAfterSend:after,afterSendReload:r4,errs};
 console.log(JSON.stringify(res));
 const ok=r1==='書きかけのメッセージ💦'&&r2==='書きかけのメッセージ💦'&&stored&&!plain&&r3===''&&after===null&&r4===''&&!errs.length;
 console.log(ok?'OK: 入力中の文が残る':'NG'); await b.close(); process.exit(ok?0:1);})();
