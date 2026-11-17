// v500: とー君と一緒に出るメッセージ（10個）が2台でそろう。最初の食い違い→ホストに合わせる／どちらが書き換えても相手に反映（入力欄も）／閉じている間の変更も開いたら反映。
const {chromium}=require('playwright');
const DIR=process.argv[2];const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'7');const PS='https://zatsugaku-push.pprnt908.workers.dev';
async function dev(b,me,peer,host,pre){const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({me,peer,host,SK,TOPIC,pre})=>{ if(sessionStorage.getItem('i'))return; sessionStorage.setItem('i','1'); localStorage.setItem('mtp_id_v1',me); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); for(const k in pre) localStorage.setItem(k,pre[k]); },{me,peer,host,SK,TOPIC,pre:pre||{}});
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); if(u.startsWith(PS))return r.continue(); return r.abort();});
 await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>ws.close());
 const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); return {pg,ctx};}
const KS=['🐶㉘','🐶㉙','🐶㊳'];
const st=(d)=>d.pg.evaluate((KS)=>({off:0,iv:'',big:0,btn:KS.map(k=>String(localStorage.getItem('mtp_cm_'+k))+'|'+document.getElementById('pf-tcm-'+k).value).join(' / ')}),KS);
const type=(d,k,txt)=>d.pg.evaluate(({k,txt})=>{ const i=document.getElementById('pf-tcm-'+k); i.value=txt; i.dispatchEvent(new Event('input',{bubbles:true})); },{k,txt});
const click=(d,id)=>d.pg.evaluate((id)=>document.getElementById(id).click(),id);
const same=(a,b)=>a.off===b.off&&a.iv===b.iv&&a.big===b.big&&a.btn===b.btn;
async function waitSame(A,B,ms){ let a,b; for(let i=0;i<ms/500;i++){ a=await st(A); b=await st(B); if(same(a,b)) return [true,a,b]; await A.pg.waitForTimeout(500); } return [false,a,b]; }
(async()=>{const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests']});
 const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true,{}), B0=await dev(b,'bbbbbbbb22','aaaaaaaa11',false,{'mtp_cm_🐶㉘':'相手の古い文'});
 let B=B0, all=true;
 const step=async(name,ms)=>{ const [ok,a,bb]=await waitSame(A,B,ms||20000); all=all&&ok; console.log(name,ok?'OK':'NG','A',JSON.stringify(a),'B',JSON.stringify(bb)); };
 await A.pg.waitForTimeout(6000);
 for(const d of [A,B]) await d.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 await step('1 最初の食い違い→ホストに合わせる');
 await type(A,'🐶㉘','ホストが書いた文'); await step('2 ホストが書き換え');
 await type(B,'🐶㊳','相手が書いた文😊'); await step('3 相手が書き換え');
 await type(B,'🐶㉙',''); await step('4 相手が空にする');
 const keepB=await B.pg.evaluate(()=>{ const o={}; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); o[k]=localStorage.getItem(k); } return o; });
 await B.ctx.close();
 await type(A,'🐶㉘','閉じている間に変えた'); await A.pg.waitForTimeout(5000);
 B=await dev(b,'bbbbbbbb22','aaaaaaaa11',false,keepB);
 await B.pg.waitForTimeout(3000); await B.pg.evaluate(()=>{ const w=document.getElementById('storage-warning'); if(w) w.hidden=true; __t.show('play'); __t.setTab('chat'); });
 await step('5 閉じている間の変更が開いたら反映',30000);
 console.log(all?'OK: とー君のメッセージが2台でそろう':'NG');
 await b.close(); process.exit(all?0:1);})();
