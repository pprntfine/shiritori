// v511: 外カメラは ImageCapture.takePhoto()（カメラ本来の画素数）で撮る。偽の takePhoto で確かめる。
//  ①縦 3000×4000 を返す → 写真は長辺 4000 級（映像の比率 3:4 で真ん中）
//  ②横 4000×3000（向きが違う）を返す → 使わず映像の1コマ
//  ③返らない → 4秒後に映像の1コマ
//  ④インカメラ → takePhoto を呼ばない（鏡像のため）
// 使い方: python3 tools/make_test.py index.html /tmp/zg && node tools/e2e/camera_takephoto.js /tmp/zg
const {chromium}=require('playwright');const DIR=process.argv[2];
async function run(b,mode,face){
 const ctx=await b.newContext({viewport:{width:390,height:844},permissions:['camera']});
 await ctx.route('**/*',r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); return r.abort();});
 await ctx.addInitScript(([mode])=>{
   window.__tpCalls=0;
   window.ImageCapture=function(track){ this.track=track; };
   window.ImageCapture.prototype.takePhoto=function(){ window.__tpCalls++;
     if(mode==='hang') return new Promise(()=>{});
     const c=document.createElement('canvas'); if(mode==='land'){c.width=4000;c.height=3000;}else{c.width=3000;c.height=4000;}
     const x=c.getContext('2d'); x.fillStyle='#ff0000'; x.fillRect(0,0,c.width,c.height/2); x.fillStyle='#0000ff'; x.fillRect(0,c.height/2,c.width,c.height/2);
     return new Promise(r=>c.toBlob(r,'image/jpeg',0.9)); };
 },[mode]);
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(2500);
 await pg.evaluate((face)=>{ const S=__t.S; S.paired=true; S.me=S.me||{}; S.me.id=S.me.id||'aaaaaaaa11'; const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); window.__camFace=face; },face);
 await pg.evaluate(()=>document.getElementById('btn-photo').click());
 await pg.waitForTimeout(3000);
 const vid=await pg.evaluate(()=>{ const v=document.getElementById('cam-video'); return {w:v.videoWidth,h:v.videoHeight}; });
 await pg.evaluate(()=>document.getElementById('cam-shoot').click());
 await pg.waitForTimeout(mode==='hang'?6000:3500);
 const shot=await pg.evaluate(()=>new Promise(res=>{ const i=document.getElementById('cam-shot'); if(!i||!i.src||i.src.length<30) return res(null); const im=new Image(); im.onload=()=>{ const c=document.createElement('canvas'); c.width=im.naturalWidth; c.height=im.naturalHeight; const x=c.getContext('2d'); x.drawImage(im,0,0); const t=x.getImageData(c.width>>1,5,1,1).data, bo=x.getImageData(c.width>>1,c.height-5,1,1).data; res({w:im.naturalWidth,h:im.naturalHeight,chars:i.src.length,top:[t[0],t[2]],bottom:[bo[0],bo[2]],via:window.__camShotVia,calls:window.__tpCalls}); }; im.onerror=()=>res(null); im.src=i.src; }));
 await ctx.close();
 return {vid,shot};
}
(async()=>{const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 let all=true; const chk=(name,ok,r)=>{ console.log(name,JSON.stringify(r),ok?'OK':'NG'); if(!ok) all=false; };
 let r=await run(b,'port','environment'); chk('①縦4000を返す',!!r.shot&&r.shot.via==='takePhoto'&&Math.max(r.shot.w,r.shot.h)>=Math.max(r.vid.w,r.vid.h)*1.3&&r.shot.top[0]>200&&r.shot.bottom[1]>200&&Math.abs(r.shot.w/r.shot.h-r.vid.w/r.vid.h)<0.02,r);
 r=await run(b,'land','environment'); chk('②向きが違う',!!r.shot&&r.shot.via==='frame'&&r.shot.calls===1,r);
 r=await run(b,'hang','environment'); chk('③返らない',!!r.shot&&r.shot.via==='frame',r);
 r=await run(b,'port','user'); chk('④インカメラ',!!r.shot&&r.shot.via==='frame'&&r.shot.calls===0,r);
 console.log(all?'OK: 外カメラは本来の画素数で撮れる':'NG');
 await b.close(); process.exit(all?0:1);})();
