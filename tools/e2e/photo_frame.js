// v502: 写真の吹き出しが写真とぴったり（余白0）。送れなかった写真の「もう一度送る」ボタンは吹き出しの中、文字の吹き出しは今まで通り余白あり。
// 使い方: python3 tools/make_test.py index.html /tmp/zg && node tools/e2e/photo_frame.js /tmp/zg
const {chromium}=require('playwright');const DIR=process.argv[2],OUT=process.argv[3]||(DIR+'/photo_frame.png');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:1});
 await ctx.route('**/*',r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); return r.abort();});
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(2500);
 await pg.evaluate(()=>{ const S=__t.S; S.me=S.me||{}; S.me.id=S.me.id||'aaaaaaaa11'; S.opp={id:'bbbbbbbb22',name:'あいて'};
  const mk=(w,h,col)=>{ const c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d'); x.fillStyle=col; x.fillRect(0,0,w,h); x.fillStyle='#fff'; x.fillRect(w*0.1,h*0.1,w*0.8,h*0.8); x.fillStyle=col; x.font=(w/8)+'px sans-serif'; x.fillText(w+'x'+h,w*0.15,h*0.5); return c.toDataURL('image/jpeg',0.8); };
  const t=Date.now();
  S.chat.push({from:S.me.id,photo:true,pid:'P1',data:mk(1500,2000,'#e33'),at:t,n:1,sent:true,acked:true,uid:'u1'});
  S.chat.push({from:S.me.id,photo:true,pid:'P2',data:mk(2000,1125,'#3a3'),at:t+1,n:2,sent:true,acked:true,uid:'u2'});
  S.chat.push({from:'bbbbbbbb22',photo:true,pid:'P3',data:mk(1500,2000,'#33e'),at:t+2,n:3,sent:true,uid:'u3'});
  S.chat.push({from:S.me.id,photo:true,pid:'P4',data:mk(800,600,'#f90'),at:t+3,n:0,sent:false,failed:true,uid:'u4'});
  S.chat.push({from:S.me.id,text:'文字の\nメッセージ',at:t+4,n:5,sent:true,uid:'u5'});
  const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); __t.renderChat(true); });
 await pg.waitForTimeout(1500);
 const m=await pg.evaluate(()=>[...document.querySelectorAll('#chat-log .msg')].filter(r=>r.querySelector('img.photo-msg')).map(r=>{ const b=r.querySelector('.bubble'), i=r.querySelector('img.photo-msg'); const bb=b.getBoundingClientRect(), ib=i.getBoundingClientRect(); const cs=getComputedStyle(b);
   return {out:r.classList.contains('out'),bubble:[Math.round(bb.width),Math.round(bb.height)],img:[Math.round(ib.width),Math.round(ib.height)],top:Math.round(ib.top-bb.top),bottom:Math.round(bb.bottom-ib.bottom),left:Math.round(ib.left-bb.left),right:Math.round(bb.right-ib.right),ws:cs.whiteSpace,pad:cs.padding,bg:cs.backgroundColor,kids:[...b.childNodes].map(n=>n.nodeType===3?'TEXT'+JSON.stringify(n.textContent):n.tagName+'.'+n.className)}; }));
 m.forEach(x=>console.log(JSON.stringify(x)));
 const extra=await pg.evaluate(()=>{ const r=[...document.querySelectorAll('#chat-log .msg')]; const f=r.find(x=>x.querySelector('.photo-retry')); const btn=f&&f.querySelector('.photo-retry'), bub=f&&f.querySelector('.bubble');
   const t=r.reverse().find(x=>x.textContent.indexOf('文字の')>=0); const tb=t&&t.querySelector('.bubble');
   const bb=btn&&btn.getBoundingClientRect(), ub=bub&&bub.getBoundingClientRect();
   return {retryInside:!!(bb&&ub&&bb.top>=ub.top-1&&bb.bottom<=ub.bottom+1&&bb.height>20), textPad:tb?getComputedStyle(tb).padding:null, textLines:tb?tb.innerText.split('\n').length:0}; });
 console.log(JSON.stringify(extra));
 const photos=m.filter(x=>x.kids.length===1);
 const ok=photos.length>=3&&photos.every(x=>x.top===0&&x.bottom===0&&x.left===0&&x.right===0)&&extra.retryInside&&extra.textPad&&extra.textPad!=='0px'&&extra.textLines===2;
 console.log(ok?'OK: 写真と吹き出しがぴったり':'NG');
 await pg.screenshot({path:OUT});
 await b.close(); process.exit(ok?0:1);})();
