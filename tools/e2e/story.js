// v515: ストーリー（インスタと同じ形）。2台・中継所あり（ntfy・MQTT はふさぐ）。
//  ① A が写真＋文字・スタンプのストーリーを投稿 → B に届く（輪っかが色つき）・A に「届いた」印
//  ② B が開く → 写真と載せ物が出る → A に既読、B の輪っかは灰色
//  ③ B のいいね・返信 → A のトークにメッセージが届く
//  ④ 大きい動画（4.5MB・3つに分けて送る）→ B でそろって同じ大きさ
//  ⑤ 本物の動画（webm）が B の見る画面で再生できる（CSP の media-src blob:）
//  ⑥ A が削除 → B からも消える
//  ⑦ B が閉じている間に投稿 → B が開いたら届く
//  ⑧ 24時間たつと消える（時計を進める）
// 使い方: bash tools/run_e2e.sh tools/e2e/story.js
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'7');const PS='https://zatsugaku-push.pprnt908.workers.dev';
async function dev(b,me,peer,host,pre){const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC,pre})=>{ if(sessionStorage.getItem('i'))return; sessionStorage.setItem('i','1'); localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); for(const k in pre) localStorage.setItem(k,pre[k]); },{me,peer,host,SK,TOPIC,pre:pre||{}});
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); if(u.startsWith(PS))return r.continue(); return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); return {pg,ctx};}
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true,{}); let B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false,{}); let all=true;
 const chk=(n,ok,x)=>{ console.log(n,JSON.stringify(x).slice(0,400),ok?'OK':'NG'); if(!ok) all=false; };
 const enter=async(d)=>d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 const until=async(d,fn,arg,ms)=>{ let v; for(let i=0;i<(ms||30000)/500;i++){ v=await d.pg.evaluate(fn,arg); if(v&&v.ok) return v; await d.pg.waitForTimeout(500); } return v||{}; };
 await A.pg.waitForTimeout(6000); await enter(A); await enter(B); await A.pg.waitForTimeout(1500);
 const postImg=(d,text)=>d.pg.evaluate(async(text)=>{ const c=document.createElement('canvas'); c.width=720; c.height=1280; const x=c.getContext('2d'); x.fillStyle='#ff4081'; x.fillRect(0,0,720,640); x.fillStyle='#2979ff'; x.fillRect(0,640,720,640);
   const u=c.toDataURL('image/webp',0.9), bin=atob(u.split(',')[1]), bytes=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
   await window.__zgStory.post('img','image/webp',bytes,0,[{t:'x',v:text,c:'#ffcc00',b:1,x:.5,y:.4,s:1},{t:'e',v:'😍',x:.3,y:.7,s:1.2}]); return window.__zgStory.list(__t.S.me.id).length; },text);
 // ①
 await postImg(A,'こんにちは');
 let r=await until(B,()=>{ const l=window.__zgStory.list('aaaaaaaa11'); const p=document.getElementById('zg-st-peer'); return {ok:l.length===1&&l[0].complete&&!p.hidden&&p.classList.contains('has')&&!p.classList.contains('seen'),n:l.length,complete:l[0]&&l[0].complete,ring:p.className,hidden:p.hidden}; });
 let ra=await until(A,()=>{ const l=window.__zgStory.list('aaaaaaaa11'); return {ok:l[0]&&l[0].acked,acked:l[0]&&l[0].acked}; });
 chk('①写真のストーリーが届く・輪っかが色つき・届いた印',r.ok&&ra.ok,{B:r,A:ra});
 // ②
 await B.pg.click('#zg-st-peer'); await B.pg.waitForTimeout(1500);
 r=await B.pg.evaluate(()=>{ const v=document.getElementById('zg-st-view'); const im=v.querySelector('.zst-media img'); return {open:!v.hidden,img:!!im&&im.naturalWidth,ov:[...v.querySelectorAll('.zst-ov')].map(e=>e.textContent),name:v.querySelector('.zst-nm').textContent,bars:v.querySelectorAll('.zst-bar').length}; });
 await B.pg.screenshot({path:'/tmp/claude-0/sc/story_view.png'});
 ra=await until(A,()=>{ const l=window.__zgStory.list('aaaaaaaa11'); return {ok:!!(l[0]&&l[0].seenAt),seenAt:l[0]&&l[0].seenAt}; });
 chk('②開くと写真と載せ物が出る・相手に既読',r.open&&r.img===720&&r.ov.join(',')==='こんにちは,😍'&&r.bars===1&&ra.ok,{B:r,A:ra});
 // ③
 await B.pg.click('#zg-st-view .zst-like'); await B.pg.waitForTimeout(300);
 await B.pg.fill('#zg-st-view .zst-reply','すてき！'); await B.pg.press('#zg-st-view .zst-reply','Enter'); await B.pg.waitForTimeout(300);
 ra=await until(A,()=>{ const t=__t.S.chat.map(m=>m.text); const l=window.__zgStory.list('aaaaaaaa11'); return {ok:t.includes('ストーリーに「いいね！」しました❤️')&&t.includes('（ストーリーへの返信）\nすてき！')&&l[0]&&l[0].liked,texts:t,liked:l[0]&&l[0].liked}; });
 chk('③いいね・返信がトークに届く',ra.ok,ra);
 await B.pg.evaluate(()=>window.__zgStory.close());
 // 閉じた後は灰色の輪っか
 r=await B.pg.evaluate(()=>document.getElementById('zg-st-peer').className);
 chk('②’見た後は灰色の輪っか',/seen/.test(r),r);
 // ④ 大きい動画（3つに分ける）
 await A.pg.evaluate(async()=>{ const n=4500000, b=new Uint8Array(n); for(let i=0;i<n;i+=65536) crypto.getRandomValues(b.subarray(i,Math.min(n,i+65536))); window.__bigSum=b.reduce((a,v)=>(a+v)%1000003,0); await window.__zgStory.post('vid','video/mp4',b,12,[]); });
 const bigSum=await A.pg.evaluate(()=>window.__bigSum);
 r=await until(B,async()=>{ const l=window.__zgStory.list('aaaaaaaa11').filter(x=>x.kind==='vid'); if(!l.length||!l[0].complete) return {ok:false,got:l[0]&&l[0].got}; const by=await window.__zgStory.bytes(l[0]); return {ok:true,n:l[0].n,size:by.length,sum:by.reduce((a,v)=>(a+v)%1000003,0)}; },null,90000);
 chk('④大きい動画が分けて届き、同じ中身',r.ok&&r.n===3&&r.size===4500000&&r.sum===bigSum,r);
 // ⑤ 本物の動画
 await A.pg.evaluate(async()=>{ const c=document.createElement('canvas'); c.width=360; c.height=640; const x=c.getContext('2d'); const st=c.captureStream(15); const rec=new MediaRecorder(st,{mimeType:'video/webm'}); const ch=[]; rec.ondataavailable=e=>ch.push(e.data);
   let f=0; const iv=setInterval(()=>{ x.fillStyle=f%2?'#00c853':'#ffd600'; x.fillRect(0,0,360,640); f++; },100);
   rec.start(); await new Promise(r=>setTimeout(r,2000)); rec.stop(); await new Promise(r=>rec.onstop=r); clearInterval(iv);
   const b=new Uint8Array(await new Blob(ch,{type:'video/webm'}).arrayBuffer()); await window.__zgStory.post('vid','video/webm',b,2,[{t:'x',v:'動画',c:'#ffffff',b:0,x:.5,y:.5,s:1}]); });
 r=await until(B,()=>{ const l=window.__zgStory.list('aaaaaaaa11').filter(x=>x.mime==='video/webm'); return {ok:l.length&&l[0].complete}; },null,40000);
 await B.pg.evaluate(()=>{ const l=window.__zgStory.list('aaaaaaaa11'); window.__zgStory.open('aaaaaaaa11'); });
 await B.pg.waitForTimeout(500);
 // webm の場面まで進める
 for(let i=0;i<8;i++){ const m=await B.pg.evaluate(()=>{ const c=window.__zgStory.cur(); return c&&c.mime; }); if(m==='video/webm') break; await B.pg.evaluate(()=>{ const s=document.querySelector('#zg-st-view .zst-stage'), r=s.getBoundingClientRect(); const o={clientX:r.right-20,clientY:r.top+r.height/2,bubbles:true,pointerId:1}; s.dispatchEvent(new PointerEvent('pointerdown',o)); s.dispatchEvent(new PointerEvent('pointerup',o)); }); await B.pg.waitForTimeout(900); }
 for(let i=0;i<15;i++){ const ok=await B.pg.evaluate(()=>{ const v=document.querySelector('#zg-st-view .zst-media video'); return !!v&&v.readyState>=1&&v.currentTime>0; }); if(ok) break; await B.pg.waitForTimeout(100); }
 r=await B.pg.evaluate(()=>{ const v=document.getElementById('zg-st-view'); const vid=v.querySelector('.zst-media video'); return {hasVid:!!vid,ready:vid&&vid.readyState,t:vid&&vid.currentTime,err:vid&&vid.error&&vid.error.code,wait:v.querySelector('.zst-wait').hidden?'':v.querySelector('.zst-wait').textContent,bars:v.querySelectorAll('.zst-bar').length}; });
 chk('⑤本物の動画が再生できる',r.hasVid&&r.ready>=1&&!r.err&&r.t>0,r);
 await B.pg.evaluate(()=>window.__zgStory.close());
 // ⑥ 削除
 await A.pg.evaluate(async()=>{ const l=window.__zgStory.list('aaaaaaaa11'); window.__zgStory.open('aaaaaaaa11'); await new Promise(r=>setTimeout(r,500)); window.confirm=()=>true; document.querySelector('#zg-st-view .zst-del').click(); await new Promise(r=>setTimeout(r,500)); window.__zgStory.close(); });
 r=await until(B,()=>{ const l=window.__zgStory.list('aaaaaaaa11'); return {ok:l.length===2,n:l.length}; });
 chk('⑥削除すると相手からも消える',r.ok,r);
 // ⑦ B が閉じている間に投稿
 const keepB=await B.pg.evaluate(()=>{ const o={}; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); o[k]=localStorage.getItem(k); } return o; });
 await B.ctx.close();
 await postImg(A,'閉じている間');
 await A.pg.waitForTimeout(3000);
 B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false,keepB); await B.pg.waitForTimeout(4000); await enter(B);
 r=await until(B,()=>{ const l=window.__zgStory.list('aaaaaaaa11'); return {ok:l.some(x=>x.ov&&x.ov[0]&&x.ov[0].v==='閉じている間'&&x.complete),n:l.length}; },null,40000);
 chk('⑦閉じている間の投稿も開いたら届く',r.ok,r);
 // ⑧ 24時間後
 r=await B.pg.evaluate(async()=>{ const real=Date.now; Date.now=()=>real()+25*3600e3; window.__zgStory.sweep(); window.__zgStory.paint(); await new Promise(r=>setTimeout(r,500)); const n=window.__zgStory.list('aaaaaaaa11').length; const hid=document.getElementById('zg-st-peer').hidden; Date.now=real; return {ok:n===0&&hid,n,hid}; });
 chk('⑧24時間で消える',r.ok,r);
 console.log(all?'OK: ストーリー':'NG');
 await b.close(); process.exit(all?0:1);})();
