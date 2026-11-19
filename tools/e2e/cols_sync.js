// v512: 1行の文字数（列数）が2台でそろう。A は幅412（18列）、B は幅360（15列）。prof の cw で小さい方（15）に両方そろう。
// トップ画面から始めて（測れない間は前に測った数）、トークを開いたら測り、変わった時だけ prof を1回送り直す。
// 使い方: bash tools/run_e2e.sh tools/e2e/cols_sync.js
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'7');const PS='https://zatsugaku-push.pprnt908.workers.dev';
async function dev(b,me,peer,host,pre,W){const ctx=await b.newContext({viewport:{width:W,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC,pre})=>{ if(sessionStorage.getItem('i'))return; sessionStorage.setItem('i','1'); localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); for(const k in pre) localStorage.setItem(k,pre[k]); },{me,peer,host,SK,TOPIC,pre:pre||{}});
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); if(u.startsWith(PS))return r.continue(); return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); return {pg,ctx};}
const cols=(d)=>d.pg.evaluate(()=>({cols:+document.documentElement.getAttribute('data-zg-cols')||0,peer:+(localStorage.getItem('zg_peer_cols')||0),mine:+(localStorage.getItem('zg_my_cols')||0)}));
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true,{},412), B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false,{},360); let all=true;
 await A.pg.waitForTimeout(6000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 let a,c; for(let i=0;i<40;i++){ a=await cols(A); c=await cols(B); if(a.cols===15&&c.cols===15&&a.peer===15&&c.peer===18) break; await A.pg.waitForTimeout(500); }
 let ok=a.cols===15&&c.cols===15&&a.peer===15&&c.peer===18; all=all&&ok; console.log('2台とも小さい方（15列）にそろう',ok?'OK':'NG','A',JSON.stringify(a),'B',JSON.stringify(c));
 const ta=await A.pg.evaluate(()=>{ const t=document.getElementById('in-chat'); const cs=getComputedStyle(t); return Math.round(t.getBoundingClientRect().width-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)-2); });
 ok=ta===15*16+8; all=all&&ok; console.log('A の入力欄の中身の幅も15列ぶん',ok?'OK':'NG',ta);
 console.log(all?'OK: 列数が2台でそろう':'NG');
 await b.close(); process.exit(all?0:1);})();
