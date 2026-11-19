// v512: 吹き出しの1行の文字数が入力欄と同じか（持ち主: 打った時と同じ改行で見せたい）。1台・中継所なし。
// 画面の幅 360/390/412/430 で、いろいろな文の「先頭から k 文字」を入力欄と吹き出しの両方に入れ、行数が全部の k で同じかを見る。
// 送った吹き出し（自分）と受け取った吹き出し（相手）の両方を見る。
// 相手の端末の列数（cw）が小さい時は、そちらに合わせて入力欄も吹き出しも同じ列数になるかも見る。
// 使い方: python3 tools/make_test.py index.html /tmp/zg && node tools/e2e/bubble_width.js /tmp/zg
const {chromium}=require('playwright');const DIR=process.argv[2];
const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+'c'.repeat(24);
const TEXTS=[
 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん',
 'ごめんーーー。お布団おったら寝てた😴　明日は朝から仕事やから、早めに寝るね。おやすみなさい！',
 '今日はPixel 7とiPhone 15で写真を送ってみたよ。ちゃんと届いたかな？OKなら返事ちょうだい👍',
 '「かっこ」や、句読点。が、行のはじめに来ないか「確かめる」ための、文章です。。。！？',
 '1行目\n\n  2行目は空白から始まる\n3行目はとても長い文章で、入力欄で折り返すところと同じところで折り返すかを見る',
 'https://example.com/aaaa/bbbb/cccc/dddd/eeee/ffff 長いURLとEnglish words mixed together here.',
];
async function lines(pg,txt){
  return pg.evaluate((txt)=>{
    const ta=document.getElementById('in-chat'); const b=document.querySelector('#chat-log .msg.out .bubble.zg-tx'), bi=document.querySelector('#chat-log .msg.in .bubble.zg-tx');
    const res=[]; const csT=getComputedStyle(ta), lhT=parseFloat(csT.lineHeight);
    const csB=getComputedStyle(b), lhB=parseFloat(csB.lineHeight);
    for(let k=1;k<=txt.length;k++){
      const p=txt.slice(0,k);
      if(/\n$/.test(p)){ res.push([0,0,0]); continue; }   /* 最後が改行の途中の文は送らない（送る時に末尾の改行を消す）ので比べない */
      ta.value=p; ta.style.height='auto';
      const nt=Math.round((ta.scrollHeight-parseFloat(csT.paddingTop)-parseFloat(csT.paddingBottom))/lhT);
      b.textContent=p;
      const nb=Math.round((b.getBoundingClientRect().height-parseFloat(csB.paddingTop)-parseFloat(csB.paddingBottom))/lhB);
      bi.textContent=p;
      const ni=Math.round((bi.getBoundingClientRect().height-parseFloat(csB.paddingTop)-parseFloat(csB.paddingBottom))/lhB);
      res.push([nt,nb,ni]);
    }
    ta.value=''; ta.dispatchEvent(new Event('input',{bubbles:true}));
    return res;
  },txt);
}
(async()=>{const b=await chromium.launch(); let all=true;
 for(const W of [360,390,412,430]){
  for(const peer of [0,13]){
   const ctx=await b.newContext({viewport:{width:W,height:844}});
   await ctx.addInitScript(({SK,TOPIC,peer})=>{ localStorage.setItem('mtp_id_v1','aaaaaaaa11'); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:1,peer:'bbbbbbbb22',peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9})); if(peer) localStorage.setItem('zg_peer_cols',String(peer)); },{SK,TOPIC,peer});
   await ctx.route('**/*',r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); return r.abort();});
   const pg=await ctx.newPage(); await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(2500);
   const info=await pg.evaluate(()=>{ const S=__t.S; __t.show('play'); __t.setTab('chat'); S.sealed=true; S.paired=true; S.opp={id:'bbbbbbbb22',name:'相手'};
     S.chat.push({uid:'u0',mid:'m0',from:'bbbbbbbb22',text:'い',at:Date.now()-2000,sent:true,n:1}); S.chat.push({uid:'u1',mid:'m1',from:'aaaaaaaa11',text:'あ',at:Date.now()-1000,sent:true,n:1}); __t.renderChat(true);
     return {cols:document.documentElement.getAttribute('data-zg-cols')}; });
   await pg.waitForTimeout(400);
   let bad=0,first='';
   for(const t of TEXTS){ const r=await lines(pg,t); r.forEach((x,i)=>{ if(x[0]!==x[1]||x[0]!==x[2]){ bad++; if(!first) first=JSON.stringify({t:t.slice(0,12),k:i+1,ta:x[0],bub:x[1],inb:x[2]}); } }); }
   const ok=bad===0&&(!peer||+info.cols<=peer);
   console.log('幅',W,'相手の列数',peer||'なし','→ 列数',info.cols,'行数の食い違い',bad,first,ok?'OK':'NG');
   if(!ok) all=false; await ctx.close();
  }
 }
 console.log(all?'OK: 入力欄と吹き出しは同じ改行':'NG'); await b.close(); process.exit(all?0:1);})();
