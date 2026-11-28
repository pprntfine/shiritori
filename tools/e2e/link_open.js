// v559: メッセージの中のアドレス（https://… www.…）を押せる。押すと設定のブラウザで開く（持ち主）。1台。
//  ① 見分け方（日本語の手前・閉じかっこ・句読点で区切る、www. は https:// を足す、javascript: や「wwww」は対象外、HTML はそのまま文字）
//  ② 標準: window.open(url,'_blank','noopener,noreferrer') ③ Android で Brave: intent://…;package=com.brave.browser;end、開けない時は知らせて標準で開く
//  ④ 設定の「リンクを開くブラウザ」で選ぶと保存される ⑤ 毎回選ぶ: 選ぶ画面から Chrome ⑥ 長押しは今までどおり反応（リンクは開かない）
//  ⑦ iPhone で Chrome: googlechromes://…
// 使い方: python3 tools/make_test.py index.html /tmp/zg && node tools/e2e/link_open.js /tmp/zg
const {chromium,devices}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+'c'.repeat(24);
const TEXTS=['見て https://example.com/a?b=1&c=2 です','https://ja.example.jp/パス','(https://example.com/x)','www.example.org。','それなwwww','javascript:alert(1)','<img src=x onerror="window.__bad=1"> http://e.example.net/z#top'];
async function open(b,opt){ const ctx=await b.newContext(opt);
 await ctx.addInitScript(({SK,TOPIC})=>{ localStorage.setItem('mtp_id_v1','aaaaaaaa11'); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:1,peer:'bbbbbbbb22',peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9}));
   window.__opened=[]; window.__hrefs=[]; window.open=function(u,t,f){ window.__opened.push([u,t,f]); return null; };
   const ck=HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click=function(){ if(/^(intent|googlechrome|firefox|brave|microsoft-edge)/.test(this.href)){ window.__hrefs.push(this.href); return; } return ck.call(this); }; },{SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); return r.abort();});
 const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>{ if(!/ServiceWorker/.test(e.message)) errs.push(e.message); });
 await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(3500);
 await pg.evaluate((TEXTS)=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat');
   const now=Date.now(); TEXTS.forEach((t,i)=>__t.S.chat.push({uid:'L'+i,mid:'ML'+i,from:i%2?'aaaaaaaa11':'bbbbbbbb22',text:t,at:now-60000+i*1000,sent:true,n:10+i})); __t.renderChat(true); },TEXTS);
 await pg.waitForTimeout(300);
 return {ctx,pg,errs}; }
const tapLink=async(pg,i)=>{ const el=pg.locator('#chat-log .msg[data-uid="L'+i+'"] .zg-link').first(); await el.scrollIntoViewIfNeeded(); await el.click(); };
(async()=>{const b=await chromium.launch(); const res={};
 const A=await open(b,{...devices['Pixel 7']}); const pg=A.pg;
 res.links=await pg.evaluate((n)=>{ const out=[]; for(let i=0;i<n;i++){ const bub=document.querySelector('#chat-log .msg[data-uid="L'+i+'"] .bubble'); out.push({txt:bub&&bub.textContent,links:bub?[...bub.querySelectorAll('.zg-link')].map(a=>[a.textContent,a.getAttribute('data-u')]):null}); } return {out,img:!!document.querySelector('#chat-log .bubble img:not(.dog-stk)'),bad:!!window.__bad}; },TEXTS.length);
 // ② 標準
 await tapLink(pg,0); await pg.waitForTimeout(200); res.std=await pg.evaluate(()=>window.__opened.slice());
 // ④ 設定で Brave を選ぶ
 await pg.evaluate(()=>{ __t.show('profile'); }); await pg.waitForTimeout(300);
 res.btn0=await pg.evaluate(()=>{ const b=document.getElementById('pf-link-br'); return b&&b.textContent; });
 await pg.evaluate(()=>document.getElementById('pf-link-br').click()); await pg.waitForTimeout(200);
 res.sheet=await pg.evaluate(()=>{ const s=document.getElementById('zg-br-sheet'); return s&&s.classList.contains('on')?[...s.querySelectorAll('.zbs-b')].map(b=>b.textContent):null; });
 await pg.screenshot({path:'/tmp/claude-0/link_sheet.png'});
 await pg.evaluate(()=>{ [...document.querySelectorAll('#zg-br-sheet .zbs-b')].find(b=>b.textContent==='Brave').click(); });
 res.saved=await pg.evaluate(()=>[localStorage.getItem('zg_link_br'),document.getElementById('pf-link-br').textContent,document.getElementById('zg-br-sheet').classList.contains('on')]);
 // ③ Android で Brave → intent、開けない（アプリが前のまま）→ 知らせて標準で開く
 await pg.evaluate(()=>{ __t.show('play'); __t.setTab('chat'); window.__opened=[]; }); await pg.waitForTimeout(300);
 await tapLink(pg,0); await pg.waitForTimeout(300); res.intent=await pg.evaluate(()=>window.__hrefs.slice());
 await pg.waitForTimeout(1900); res.fallback=await pg.evaluate(()=>({opened:window.__opened.slice(),toast:(document.getElementById('toast')||{}).textContent||''}));
 // ⑤ 毎回選ぶ
 await pg.evaluate(()=>{ localStorage.setItem('zg_link_br','ask'); window.__hrefs=[]; window.__opened=[]; });
 await tapLink(pg,3); await pg.waitForTimeout(200);
 res.ask=await pg.evaluate(()=>{ const s=document.getElementById('zg-br-sheet'); return {on:s.classList.contains('on'),t:s.querySelector('.zbs-t').textContent,u:s.querySelector('.zbs-u').textContent}; });
 await pg.screenshot({path:'/tmp/claude-0/link_ask.png'});
 await pg.evaluate(()=>{ [...document.querySelectorAll('#zg-br-sheet .zbs-b')].find(b=>b.textContent==='Chrome').click(); }); await pg.waitForTimeout(100);
 res.askHref=await pg.evaluate(()=>window.__hrefs.slice()); await pg.waitForTimeout(2000);
 // ⑥ 長押し（0.7秒）は反応の画面が出て、リンクは開かない
 await pg.evaluate(()=>{ localStorage.removeItem('zg_link_br'); window.__opened=[]; window.__hrefs=[]; });
 const el=pg.locator('#chat-log .msg[data-uid="L0"] .zg-link').first(); await el.scrollIntoViewIfNeeded(); const bb=await el.boundingBox();
 await pg.mouse.move(bb.x+5,bb.y+5); await pg.mouse.down(); await pg.waitForTimeout(800); const pal=await pg.evaluate(()=>!!document.getElementById('reaction-palette')); await pg.mouse.up(); await pg.waitForTimeout(2200);
 res.long=await pg.evaluate((pal)=>({pal,opened:window.__opened.length+window.__hrefs.length}),pal);
 await pg.evaluate(()=>{ try{ document.getElementById('reaction-palette').remove(); }catch(e){} });
 await pg.screenshot({path:'/tmp/claude-0/link_chat.png'});
 res.errs=A.errs.slice();
 // ⑦ iPhone
 const I=await open(b,{...devices['iPhone 14']});
 await I.pg.evaluate(()=>localStorage.setItem('zg_link_br','chrome')); await tapLink(I.pg,0); await I.pg.waitForTimeout(200);
 res.ios=await I.pg.evaluate(()=>window.__hrefs.slice());
 res.iosList=await I.pg.evaluate(()=>{ __t.show('profile'); document.getElementById('pf-link-br').click(); return [...document.querySelectorAll('#zg-br-sheet .zbs-b')].map(b=>b.textContent); });
 res.errs=res.errs.concat(I.errs);
 console.log(JSON.stringify(res));
 const L=res.links.out, eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const ok=eq(L[0].links,[['https://example.com/a?b=1&c=2','https://example.com/a?b=1&c=2']])&&L[0].txt===TEXTS[0]
  &&eq(L[1].links,[['https://ja.example.jp/','https://ja.example.jp/']])&&L[1].txt===TEXTS[1]
  &&eq(L[2].links,[['https://example.com/x','https://example.com/x']])&&L[2].txt===TEXTS[2]
  &&eq(L[3].links,[['www.example.org','https://www.example.org/']])&&L[4].links.length===0&&L[5].links.length===0
  &&eq(L[6].links,[['http://e.example.net/z#top','http://e.example.net/z#top']])&&L[6].txt===TEXTS[6]&&!res.links.img&&!res.links.bad
  &&eq(res.std,[['https://example.com/a?b=1&c=2','_blank','noopener,noreferrer']])
  &&res.btn0==='標準'&&res.sheet&&res.sheet.length===11&&eq(res.saved,['brave','Brave',false])
  &&eq(res.intent,['intent://example.com/a?b=1&c=2#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.brave.browser;end'])
  &&res.fallback.opened.length===1&&/Braveで開けませんでした/.test(res.fallback.toast)
  &&res.ask.on&&res.ask.u==='https://www.example.org/'&&res.askHref.length===1&&/package=com\.android\.chrome;end$/.test(res.askHref[0])&&/^intent:\/\/www\.example\.org\//.test(res.askHref[0])
  &&res.long.pal&&res.long.opened===0
  &&eq(res.ios,['googlechromes://example.com/a?b=1&c=2'])&&res.iosList.length===6&&!res.errs.length;
 console.log(ok?'OK: アドレスを押すと選んだブラウザで開く':'NG'); await b.close(); process.exit(ok?0:1);})();
