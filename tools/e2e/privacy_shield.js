// v512: ホーム・タスク一覧でトークを見せない（持ち主）。1台・中継所なし。
//  ① 画面を離れる瞬間（blur）に覆いが出る／戻る（focus）と消えてトークのまま
//  ② 裏に回る（visibilitychange hidden）とその場でトップへ＋覆い。戻った時はトップ（トークは一度も出ない）
//  ③ freeze・pagehide の合図でも同じ（CDP の凍結は headless では freeze の合図が出ないので、合図を直接出す）
//  ④ 電話の画面が出ている時は画面を移さない（覆いだけ）。戻ると電話の画面のまま
//  ⑤ 音声入力中の blur では覆わない
// 使い方: python3 tools/make_test.py index.html /tmp/zg && node tools/e2e/privacy_shield.js /tmp/zg
const {chromium}=require('playwright');const DIR=process.argv[2];
const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+'c'.repeat(24);
(async()=>{const b=await chromium.launch(); let all=true; const chk=(n,ok,x)=>{ console.log(n,JSON.stringify(x),ok?'OK':'NG'); if(!ok) all=false; };
 const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({SK,TOPIC})=>{ localStorage.setItem('mtp_id_v1','aaaaaaaa11'); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:1,peer:'bbbbbbbb22',peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9}));
   window.__vis='visible'; Object.defineProperty(document,'visibilityState',{get:()=>window.__vis,configurable:true}); Object.defineProperty(document,'hidden',{get:()=>window.__vis!=='visible',configurable:true}); },{SK,TOPIC});
 await ctx.route('**/*',r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); return r.abort();});
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(2500);
 const enter=()=>pg.evaluate(()=>{ const S=__t.S; S.linked=true; S.sealed=true; S.paired=true; S.opp={id:'bbbbbbbb22',name:'相手'}; __t.show('play'); __t.setTab('chat'); });
 const st=()=>pg.evaluate(()=>({phase:__t.S.phase,shield:document.getElementById('zg-shield').classList.contains('on'),chatShown:document.getElementById('s-play').classList.contains('on')}));
 await enter();
 await pg.evaluate(()=>window.dispatchEvent(new Event('blur'))); let a=await st();
 await pg.evaluate(()=>window.dispatchEvent(new Event('focus'))); await pg.waitForTimeout(150); let c=await st();
 chk('①離れる瞬間に覆う・戻ると消える',a.shield&&a.phase==='play'&&!c.shield&&c.phase==='play',{blur:a,focus:c});
 await pg.evaluate(()=>{ window.dispatchEvent(new Event('blur')); window.__vis='hidden'; document.dispatchEvent(new Event('visibilitychange')); }); a=await st();
 await pg.evaluate(()=>{ window.__vis='visible'; document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); });
 const firstFrame=await pg.evaluate(()=>new Promise(res=>requestAnimationFrame(()=>res({phase:__t.S.phase,chatShown:document.getElementById('s-play').classList.contains('on')}))));
 await pg.waitForTimeout(200); c=await st();
 chk('②裏に回るとその場でトップ・戻ってもトーク無し',a.shield&&a.phase==='lobby'&&!a.chatShown&&!firstFrame.chatShown&&!c.shield&&c.phase==='lobby',{hidden:a,first:firstFrame,back:c});
 await enter(); await pg.waitForTimeout(200);
 await pg.evaluate(()=>document.dispatchEvent(new Event('freeze'))); a=await st();
 await enter(); await pg.waitForTimeout(100); await pg.evaluate(()=>window.dispatchEvent(new Event('pagehide'))); c=await st();
 await pg.evaluate(()=>window.dispatchEvent(new Event('pageshow'))); await pg.waitForTimeout(200);
 chk('③freeze・pagehide でもトップへ',a.phase==='lobby'&&!a.chatShown&&a.shield&&c.phase==='lobby'&&!c.chatShown,{freeze:a,pagehide:c});
 await enter(); await pg.evaluate(()=>{ document.getElementById('call-box').hidden=false; window.__vis='hidden'; document.dispatchEvent(new Event('visibilitychange')); }); a=await st();
 await pg.evaluate(()=>{ window.__vis='visible'; document.dispatchEvent(new Event('visibilitychange')); }); await pg.waitForTimeout(200); c=await st();
 await pg.evaluate(()=>{ document.getElementById('call-box').hidden=true; });
 chk('④電話中は画面を移さない',a.shield&&a.phase==='play'&&!c.shield&&c.phase==='play',{hidden:a,back:c});
 await enter(); await pg.evaluate(()=>{ window.__zgVoiceOn=true; window.dispatchEvent(new Event('blur')); }); a=await st(); await pg.evaluate(()=>{ window.__zgVoiceOn=false; window.dispatchEvent(new Event('focus')); });
 chk('⑤音声入力中の blur は覆わない',!a.shield&&a.phase==='play',a);
 // 5回タップでまた入れる
 await pg.evaluate(()=>{ __t.show('lobby'); }); for(let i=0;i<5;i++){ await pg.click('.brand'); await pg.waitForTimeout(120); } await pg.waitForTimeout(800); a=await st();
 chk('⑥トップの5回タップでトークに入れる',a.phase==='play'&&!a.shield,a);
 console.log(all?'OK: トークは裏に回ると隠れる':'NG'); await b.close(); process.exit(all?0:1);})();
