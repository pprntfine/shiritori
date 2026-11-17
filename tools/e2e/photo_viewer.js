// v495: 受け取った写真をタップ → 全画面で出て、「高画質を読み込んでいます…」が出たままにならない（1台・通信なし）
const {chromium}=require('playwright');
const DIR=process.argv[2];
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.route('**/*',r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); return r.abort();});
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(2500);
 const sent=[];
 await pg.evaluate(()=>{
   const c=document.createElement('canvas'); c.width=300; c.height=500; const x=c.getContext('2d'); x.fillStyle='#e33'; x.fillRect(0,0,300,250); x.fillStyle='#33e'; x.fillRect(0,250,300,250);
   const S=__t.S; S.me=S.me||{}; S.me.id=S.me.id||'aaaaaaaa11'; S.opp={id:'bbbbbbbb22',name:'あいて'};
   S.chat.push({from:'bbbbbbbb22',photo:true,pid:'ptest1',data:c.toDataURL('image/jpeg',0.9),at:Date.now(),n:1,uid:'u9001'});
   const w=document.getElementById('storage-warning'); if(w) w.hidden=true;
   __t.show('play'); __t.setTab('chat'); __t.renderChat(true);
   window.__hqAsk=0; const o=__t.Net.send; __t.Net.send=function(env){ if(env&&env.t==='photo-hq') window.__hqAsk++; return o.apply(this,arguments); };
 });
 await pg.waitForTimeout(800);
 const img=await pg.$('#chat-log img.photo-msg'); if(!img){ console.log('NG: 写真の行がない'); process.exit(1); }
 await img.click(); await pg.waitForTimeout(1200);
 const st=()=>pg.evaluate(()=>{ const v=document.querySelector('.img-viewer'), n=document.querySelector('.img-viewer-note'), i=document.querySelector('.img-viewer-img');
   return {open:!!(v&&v.classList.contains('on')), note:(n&&!n.hidden)?n.textContent:'(なし)', imgW:i?i.naturalWidth:0, ask:window.__hqAsk}; });
 const s1=await st(); console.log('タップ1.2秒後',JSON.stringify(s1));
 await pg.waitForTimeout(9500);
 const s2=await st(); console.log('タップ10.7秒後',JSON.stringify(s2));
 await pg.screenshot({path:DIR+'/photo_viewer.png'});
 const ok=s1.open&&s1.imgW>0&&s1.note==='(なし)'&&s2.note==='(なし)'&&s2.ask===0;
 console.log(ok?'OK: 全画面で出て、読み込み中の案内は出ない':'NG');
 await b.close(); process.exit(ok?0:1);})();
