// v498: 入力した形（改行・空行・行頭の空白）のまま送られ、両方の画面にその形で出る。
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'9');const PS='https://zatsugaku-push.pprnt908.workers.dev';
async function dev(b,me,peer,host){const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC})=>{ if(sessionStorage.getItem('i'))return; sessionStorage.setItem('i','1'); localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{me,peer,host,SK,TOPIC});
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); if(u.startsWith(PS))return r.continue(); return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); return {pg};}
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false);
 await A.pg.waitForTimeout(8000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 // キーボードで打つ（Enter は改行）
 await A.pg.click('#in-chat');
 const lines=['1行目','','  3行目（前に空白2つ）','4行目',''];
 for(let i=0;i<lines.length;i++){ if(lines[i]) await A.pg.keyboard.type(lines[i]); if(i<lines.length-1) await A.pg.keyboard.press('Enter'); }
 const typed=await A.pg.$eval('#in-chat',e=>e.value);
 await A.pg.click('#btn-chat-send');
 await A.pg.waitForTimeout(6000);
 const look=(d,mine)=>d.pg.evaluate((mine)=>{ const m=__t.S.chat.filter(x=>x&&!x.sys&&x.text&&x.text.indexOf('1行目')===0).pop(); const rows=[...document.querySelectorAll('#chat-log .msg'+(mine?'.out':':not(.out)'))]; const row=rows.reverse().find(r=>r.textContent.indexOf('1行目')>=0); const bub=row&&(row.querySelector('.bubble .txt')||row.querySelector('.bubble')); return {text:m?m.text:null, shown:bub?bub.innerText:null, ws:bub?getComputedStyle(bub).whiteSpace:null}; },mine);
 const a=await look(A,true), bb=await look(B,false);
 console.log('入力欄',JSON.stringify(typed)); console.log('A（送った側）',JSON.stringify(a)); console.log('B（受け取った側）',JSON.stringify(bb));
 await B.pg.screenshot({path:DIR+'/newline_B.png'});
 const want=typed.replace(/\n+$/,'');   // 最後の空行だけは送らない
 const shape=(x)=>!!x&&x.split('\n').length>=4&&x.indexOf('  3行目')>=0;
 await A.pg.screenshot({path:DIR+'/newline_A.png'});
 const ok=a.text===want&&bb.text===want&&shape(a.shown)&&shape(bb.shown);
 console.log(ok?'OK: 入力した形のまま届く':'NG');
 await b.close(); process.exit(ok?0:1);})();
