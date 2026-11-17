// v501: アプリ内カメラで撮った写真の大きさ（偽カメラ）。長辺が 2000 近くで撮れること（v500 までは約960）。
// 使い方: python3 tools/make_test.py index.html /tmp/zg && node tools/e2e/camera_res.js /tmp/zg
const {chromium}=require('playwright');const DIR=process.argv[2];
(async()=>{const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 const ctx=await b.newContext({viewport:{width:390,height:844},permissions:['camera']});
 await ctx.route('**/*',r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); return r.abort();});
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(2500);
 await pg.evaluate(()=>{ const S=__t.S; S.paired=true; S.me=S.me||{}; S.me.id=S.me.id||'aaaaaaaa11'; const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 await pg.evaluate(()=>document.getElementById('btn-photo').click());
 await pg.waitForTimeout(3000);
 const vid=await pg.evaluate(()=>{ const v=document.getElementById('cam-video'); return {w:v.videoWidth,h:v.videoHeight}; });
 await pg.evaluate(()=>document.getElementById('cam-shoot').click());
 await pg.waitForTimeout(2000);
 const shot=await pg.evaluate(()=>new Promise(res=>{ const i=document.getElementById('cam-shot'); const im=new Image(); im.onload=()=>res({w:im.naturalWidth,h:im.naturalHeight,chars:i.src.length}); im.onerror=()=>res(null); im.src=i.src; }));
 console.log('カメラの映像',JSON.stringify(vid),'撮れた写真',JSON.stringify(shot));
 const ok=!!shot&&Math.max(shot.w,shot.h)>=1500;
 console.log(ok?'OK: 大きく撮れる':'NG');
 await b.close(); process.exit(ok?0:1);})();
