const {chromium}=require('playwright');
const DIR=process.argv[2], PEER_RL=process.argv[3]!=='norl';
const SK=Buffer.alloc(32,7).toString('base64'), TOPIC='gskr3s-'+Date.now().toString(16).padEnd(24,'a');
const PS='https://zatsugaku-push.pprnt908.workers.dev';
async function dev(b,me,peer,host,log){
  const ctx=await b.newContext({viewport:{width:390,height:800}});
  await ctx.addInitScript(({me,peer,host,SK,TOPIC,PS,PEER_RL})=>{
    if(sessionStorage.getItem('init'))return; sessionStorage.setItem('init','1');
    localStorage.setItem('mtp_id_v1',me);
    localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:host?1:0,peer,peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+1e9}));
    /* v473 test: no psrv, no relay flags */
  },{me,peer,host,SK,TOPIC,PS,PEER_RL});
  const blocked={ntfy:0,mqtt:0};
  await ctx.route('**/*',async r=>{const u=r.request().url();
    if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')});
    if(u.startsWith(PS))return r.continue();
    if(u.includes('ntfy.sh'))blocked.ntfy++;
    return r.abort();});
  await ctx.routeWebSocket(u=>!String(u).includes('zatsugaku-push'),ws=>{const u=ws.url();
    if(u.startsWith('wss://zgtest.workers.dev')){ ws.connectToServer(); return; }
    if(u.includes('ntfy'))blocked.ntfy++; else blocked.mqtt++; ws.close();});
  const pg=await ctx.newPage(); pg.on('pageerror',e=>log.push(me+' ERR '+e.message)); pg.on('console',m=>{ if(/websocket|Content Security|Refused/i.test(m.text())) log.push(me+' CON '+m.text().slice(0,200)); });
  await pg.goto('https://zg.test/index.html'); return {pg,blocked};
}
(async()=>{
  const b=await chromium.launch({args:['--ignore-certificate-errors','--no-proxy-server','--host-resolver-rules=MAP zatsugaku-push.pprnt908.workers.dev 127.0.0.1','--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessRespectPreflightResults']}); const log=[];
  const A=await dev(b,'aaaaaaaa11','bbbbbbbb22',true,log), Bd=await dev(b,'bbbbbbbb22','aaaaaaaa11',false,log);
  await A.pg.waitForTimeout(9000);
  const st=async p=>p.evaluate(()=>({psrv:__t.psrvRaw(),has:!!__t.relayHas(),rs:__t.Relay.ws&&__t.Relay.ws.readyState,pr:(function(){try{return privateReady}catch(e){return 'x'}})()===undefined,up:__t.Relay.up,topic:!!__t.Relay.topic,send:__t.relaySendBase(),paired:__t.S.paired}));
  console.log('A',JSON.stringify(await st(A.pg)),'B',JSON.stringify(await st(Bd.pg)));
  await A.pg.evaluate(()=>{__t.show('play');__t.setTab('chat');window.__r=null; __t.Net.send({t:'chats',items:[{text:'こんにちは 中継所',at:Date.now(),mid:__t.newChatId()}]},function(ok){window.__r=ok;});});
  let got=false;
  for(let i=0;i<20&&!got;i++){ await Bd.pg.waitForTimeout(500); got=await Bd.pg.evaluate(()=>__t.S.chat.some(m=>m.text==='こんにちは 中継所')); }
  console.log('B received:',got); console.log('A dbg',JSON.stringify(await A.pg.evaluate(async()=>({pr:__t.privateReady(),sc:!!__t.privateScope(),ob:(__t.S.outbox||[]).length,os:await __t.outSave(),warn:(document.getElementById('storage-warning')||{}).textContent,isHost:__t.S.isHost,guest:__t.S.guest,opp:__t.S.opp,nk:__t.Net.key===__t.S.sessKey,nr:__t.Net.key===__t.Net.roomKey}))));
  // B replies
  await Bd.pg.evaluate(()=>{__t.Net.send({t:'chats',items:[{text:'とどいたよ',at:Date.now(),mid:__t.newChatId()}]},function(){});});
  let got2=false; for(let i=0;i<20&&!got2;i++){ await A.pg.waitForTimeout(500); got2=await A.pg.evaluate(()=>__t.S.chat.some(m=>m.text==='とどいたよ')); }
  console.log('A received reply:',got2);
  await A.pg.waitForTimeout(3000);
  const meta=await A.pg.evaluate(()=>({sendOk:window.__r}));
  console.log('A msg status',JSON.stringify(meta),'via',await A.pg.evaluate(()=>__t.Net.lastVia));
  // EVIL: 3人目が ちがう鍵で つくった にせメッセージ と ただの 乱数 を 中継所へ
  const before=await Bd.pg.evaluate(()=>__t.S.chat.length);
  await A.pg.evaluate(async(T)=>{
    const k=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt']);
    const env={v:4,n:Date.now(),from:'evil999999',to:'bbbbbbbb22',t:'chats',sec:289,items:[{text:'にせもの',at:Date.now(),mid:'Mx'}]};
    const iv=crypto.getRandomValues(new Uint8Array(12));const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},k,new TextEncoder().encode(JSON.stringify(env))));
    const all=new Uint8Array(12+ct.length);all.set(iv);all.set(ct,12);let b='';all.forEach(x=>b+=String.fromCharCode(x));
    await fetch('https://zatsugaku-push.pprnt908.workers.dev/r/'+T,{method:'POST',body:btoa(b)});
    await fetch('https://zatsugaku-push.pprnt908.workers.dev/r/'+T,{method:'POST',body:btoa('x'.repeat(300))});
  },TOPIC);
  await Bd.pg.waitForTimeout(2500);
  console.log('EVIL rejected:',await Bd.pg.evaluate(()=>!__t.S.chat.some(m=>m.text==='にせもの')),'chat len same:',(await Bd.pg.evaluate(()=>__t.S.chat.length))===before);
  // photo test
  const png=await A.pg.evaluate(async()=>{const c=document.createElement('canvas');c.width=600;c.height=400;const x=c.getContext('2d');for(let i=0;i<400;i+=4){x.fillStyle='hsl('+i+',70%,50%)';x.fillRect(0,i,600,4);}const b=await new Promise(r=>c.toBlob(r,'image/jpeg',.9));return Array.from(new Uint8Array(await b.arrayBuffer()));});
  await A.pg.evaluate((arr)=>{window.__pr=null;__t.Net.sendFile({t:'photo',id:'ph'+Date.now(),at:Date.now()},new Uint8Array(arr),function(ok){window.__pr=ok;});},png);
  let gp=false; for(let i=0;i<30&&!gp;i++){ await Bd.pg.waitForTimeout(500); gp=await Bd.pg.evaluate(()=>__t.S.chat.some(m=>m.photo&&m.data&&m.data.length>1000)); }
  console.log('photo ('+png.length+' bytes) sendOk',await A.pg.evaluate(()=>window.__pr),'B got photo:',gp,'via',await A.pg.evaluate(()=>__t.Net.lastVia));
  // offline test
  const bctx=Bd.pg.context(); await Bd.pg.close();
  await A.pg.evaluate(()=>{__t.Net.send({t:'chats',items:[{text:'あとで よんでね',at:Date.now(),mid:__t.newChatId()}]},function(ok){window.__r2=ok;});});
  await A.pg.waitForTimeout(2000);
  const pg2=await bctx.newPage(); await pg2.goto('https://zg.test/index.html');
  let got3=false; for(let i=0;i<30&&!got3;i++){ await pg2.waitForTimeout(500); got3=await pg2.evaluate(()=>!!(window.__t&&__t.S.chat.some(m=>m.text==='あとで よんでね'))); }
  console.log('offline msg delivered on reopen:',got3,'sendOk',await A.pg.evaluate(()=>window.__r2));
  await A.pg.evaluate(()=>{ __t.Net.sendChunk({t:'photo-chunk',id:'pc1',i:0,total:1,data:'x'.repeat(1000)}); });
  await A.pg.waitForTimeout(1500);
  console.log('chunk stored to relay while partner closed:', await A.pg.evaluate(async(T)=>{ const r=await fetch('https://zatsugaku-push.pprnt908.workers.dev/r/'+T+'/json?poll=1&since=0'); const t=await r.text(); return t.trim().split('\n').length; },TOPIC));
  console.log('MARK A',await A.pg.evaluate(()=>__t.sasLabel()),'B',await pg2.evaluate(()=>__t.sasLabel()),'strip',await A.pg.evaluate(()=>(document.getElementById('zg-room-strip')||{}).textContent));
  console.log('blocked A',JSON.stringify(A.blocked),'B',JSON.stringify(Bd.blocked)); console.log(log.slice(0,5).join('\n'));
  await b.close();})();
