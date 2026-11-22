// v534: 片方が「削除」で電話の記録を消すと、相手の端末の電話の記録も消える（メッセージは消えない）。
// 相手が閉じている間に送っても、あとで開けば消える。相手の「受け取った」で送るのをやめる。
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'e');const PS='https://zatsugaku-push.pprnt908.workers.dev';
const DIRB=process.env.OLD_DIR||DIR;
async function dev(b,me,peer,host){ const D=host?DIR:DIRB;const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC,BOOT})=>{ if(sessionStorage.getItem('i'))return; sessionStorage.setItem('i','1'); if(!BOOT) localStorage.setItem('zg.clclear_boot','1'); localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); },{me,peer,host,SK,TOPIC,BOOT:host&&!!process.env.BOOT});
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:D+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); if(u.startsWith(PS))return r.continue(); return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>{ if(!/ServiceWorker/.test(e.message)) errs.push(e.message); }); await pg.goto('https://zg.test/index.html'); return {pg,errs,ctx};}
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false);
 await A.pg.waitForTimeout(8000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 const add=d=>d.pg.evaluate(()=>{ const now=Date.now(); __t.S.chat.push({sys:true,callLog:true,text:'📞 古い記録',at:now-3600000,mid:'cl1'}); __t.S.chat.push({uid:'t1',mid:'Mt1',from:__t.S.opp.id,text:'のこる',at:now-1000,sent:true,n:7}); });
 await add(A); await add(B);
 const cnt=d=>d.pg.evaluate(()=>({cl:__t.S.chat.filter(m=>m.callLog).length,txt:__t.S.chat.filter(m=>m.text==='のこる').length}));
 console.log('消す前 A',JSON.stringify(await cnt(A)),'B',JSON.stringify(await cnt(B)));
 if(process.env.BOOT){ console.log('（A を読み込み直す＝最初に開いた時の1回だけの合図）'); await A.pg.evaluate(()=>{ localStorage.removeItem('zg.clclear_boot'); localStorage.removeItem('zg.clclear1'); }); await A.pg.reload(); } else { await A.pg.evaluate(()=>{ document.getElementById('btn-delchat').click(); }); await A.pg.waitForTimeout(300); await A.pg.click('#del-yes'); }
 let ok1=false; for(let i=0;i<(process.env.OLD_DIR?8:(process.env.BOOT?60:40))&&!ok1;i++){ await B.pg.waitForTimeout(500); ok1=(await cnt(B)).cl===0; }
 const cb=await cnt(B), ca=await cnt(A);
 console.log('消した後 A',JSON.stringify(ca),'B',JSON.stringify(cb));
 await A.pg.waitForTimeout(3000);
 const pend=await A.pg.evaluate(()=>localStorage.getItem('zg.clclear1'));
 console.log('送るのをやめた（受け取りが来た）:',pend===null);
 // 新しい電話の記録は、B で消した後にできたもの → もう一度送られても消えない（at より新しい）
 if(process.env.OLD_DIR){ const o2=ca.cl===0&&cb.cl===1&&cb.txt===1&&pend!==null&&!B.errs.length; console.log(o2?'OK: 相手が古い版でも何も壊れず、こちらは送り続ける':'NG',B.errs); await b.close(); process.exit(o2?0:1); }
 const ok=(process.env.BOOT?true:ca.cl===0)&&cb.cl===0&&cb.txt===1&&pend===null&&!A.errs.length&&!B.errs.length;
 console.log(ok?'OK: 相手の電話の記録も消える・メッセージは残る':'NG',A.errs,B.errs); await b.close(); process.exit(ok?0:1);})();
