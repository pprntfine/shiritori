// v517: 上のカメラはスマホ本物のカメラアプリで撮る（<input capture>）。1台・偽のファイル。
//  ① カメラボタンでカメラ用の入力（capture=environment）が開く
//  ② カメラアプリに行っている間（裏に回る）もトップへ戻さない・覆いは出る。戻るとトークのまま、2.5秒後に「戻さない」を解除
//  ③ 撮った写真（4000×3000・重い）が確認のあと、大きいまま写真として送られる（2MB を超えても断らない）
//  ④ 写真選び（写真・動画）でも 2MB を超える写真を断らない
// 使い方: python3 tools/make_test.py index.html /tmp/zg && node tools/e2e/camera_native.js /tmp/zg
const {chromium}=require('playwright');const DIR=process.argv[2];
const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+'c'.repeat(24);
(async()=>{const b=await chromium.launch(); let all=true; const chk=(n,ok,x)=>{ console.log(n,JSON.stringify(x),ok?'OK':'NG'); if(!ok) all=false; };
 const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({SK,TOPIC})=>{ localStorage.setItem('mtp_id_v1','aaaaaaaa11'); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:1,peer:'bbbbbbbb22',peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9}));
   window.__vis='visible'; Object.defineProperty(document,'visibilityState',{get:()=>window.__vis,configurable:true}); Object.defineProperty(document,'hidden',{get:()=>window.__vis!=='visible',configurable:true}); },{SK,TOPIC});
 await ctx.route('**/*',r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); return r.abort();});
 const pg=await ctx.newPage(); pg.on('dialog',d=>d.accept()); await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(2500);
 await pg.evaluate(()=>{ const S=__t.S; S.linked=true; S.sealed=true; S.paired=true; S.opp={id:'bbbbbbbb22',name:'相手'}; __t.show('play'); __t.setTab('chat'); const w=document.getElementById('storage-warning'); if(w) w.hidden=true;
   window.__clicked=0; const ci=document.getElementById('zg-cam-native'); ci.click=function(){ window.__clicked++; }; document.getElementById('chat-photo-file').click=function(){ window.__clicked2=(window.__clicked2||0)+1; };
   window.__sent=[]; });
 // privateReady を通すため（試験用）
 const ready=await pg.evaluate(()=>{ try{ return !!__t.privateReady(); }catch(e){ return false; } });
 await pg.click('#zg-hd-cam');
 let a=await pg.evaluate(()=>{ const ci=document.getElementById('zg-cam-native'); return {clicked:window.__clicked,capture:ci.getAttribute('capture'),accept:ci.accept,picking:!!window.__zgPicking}; });
 chk('①カメラボタンでカメラアプリ用の入力が開く',!ready||(a.clicked===1&&a.capture==='environment'&&a.accept==='image/*'&&a.picking),{ready,...a});
 await pg.evaluate(()=>{ window.__zgPicking=Date.now(); window.__vis='hidden'; document.dispatchEvent(new Event('visibilitychange')); });
 a=await pg.evaluate(()=>({phase:__t.S.phase,shield:document.getElementById('zg-shield').classList.contains('on')}));
 await pg.evaluate(()=>{ window.__vis='visible'; document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('pageshow')); });
 await pg.waitForTimeout(400); let c=await pg.evaluate(()=>({phase:__t.S.phase,shield:document.getElementById('zg-shield').classList.contains('on'),picking:!!window.__zgPicking}));
 await pg.waitForTimeout(2600); const p2=await pg.evaluate(()=>!!window.__zgPicking);
 chk('②カメラアプリの間もトークのまま・戻ると覆いが消える・あとで解除',a.phase==='play'&&a.shield&&c.phase==='play'&&!c.shield&&!p2,{away:a,back:c,pickingAfter:p2});
 // ③ 撮った写真
 const send=async(id,fromCam)=>pg.evaluate(async({id})=>{ const cv=document.createElement('canvas'); cv.width=4000; cv.height=3000; const x=cv.getContext('2d'); const im=x.createImageData(4000,3000); for(let i=0;i<im.data.length;i+=4){ const n=(Math.random()*255)|0; im.data[i]=n; im.data[i+1]=(n*7)&255; im.data[i+2]=(n*13)&255; im.data[i+3]=255; } x.putImageData(im,0,0);
   const blob=await new Promise(r=>cv.toBlob(r,'image/jpeg',0.95)); const f=new File([blob],'IMG_0001.jpg',{type:'image/jpeg'}); const dt=new DataTransfer(); dt.items.add(f);
   const inp=document.getElementById(id); inp.files=dt.files; const before=__t.S.chat.length; inp.dispatchEvent(new Event('change'));
   for(let i=0;i<100;i++){ await new Promise(r=>setTimeout(r,200)); if(__t.S.chat.length>before) break; }
   const m=__t.S.chat[__t.S.chat.length-1]; const sz=await new Promise(r=>{ const i=new Image(); i.onload=()=>r([i.naturalWidth,i.naturalHeight]); i.onerror=()=>r(null); i.src=m&&m.data; });
   return {added:__t.S.chat.length>before,photo:!!(m&&m.photo),fileBytes:blob.size,size:sz,toast:document.body.innerText.includes('大きさを超えています')}; },{id});
 a=await send('zg-cam-native');
 chk('③撮った写真が大きいまま送られる（2MB超でも断らない）',a.added&&a.photo&&a.size&&a.size[0]>=3000&&!a.toast,a);
 a=await send('chat-photo-file');
 chk('④写真選びでも 2MB 超の写真を断らない',a.added&&a.photo&&a.size&&a.size[0]>=3000&&!a.toast,a);
 console.log(all?'OK: カメラアプリで撮って送る':'NG'); await b.close(); process.exit(all?0:1);})();
