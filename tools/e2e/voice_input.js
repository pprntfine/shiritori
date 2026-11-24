// v513: 音声入力（持ち主: 送信の横にマイク。声で文字を打つ・声は送らない。声の文に内容に合う絵文字を自動で付ける）。1台・偽の音声認識。
//  ① マイクは入力欄の左端にいつもある（v541: 右端は絵文字ボタン）。送信ボタンはいつも送信
//  ② マイクを押す → 初回だけ確認 → 聞き取り中は赤 → 話した言葉が入力欄に入る（途中の結果も）→ 終わると「明日は晴れるかな☀️」（絵文字が付く）
//  ③ 送信ボタンで送る（声は送らない）
//  ④ 2回目は確認なし・文字がある時に押すと続きに足す・もう一度押すと止まる
//  ⑤ 音声認識が無い端末はキーボードのマイクを案内して入力欄にカーソル
//  ⑥ マイクが許可されていない時はお知らせ
//  ⑦ 設定で絵文字をオフにすると付かない
//  ⑧ 絵文字の表（おはよう→☀️、ありがとう→🙏 など。最大2つ・もう絵文字がある時は足さない）
// 使い方: python3 tools/make_test.py index.html /tmp/zg && node tools/e2e/voice_input.js /tmp/zg
const {chromium}=require('playwright');const DIR=process.argv[2];
const SK=Buffer.alloc(32,9).toString('base64'),TOPIC='gskr3s-'+'c'.repeat(24);
async function open(b,withSR,mode){
 const ctx=await b.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(({SK,TOPIC,withSR,mode})=>{ localStorage.setItem('mtp_id_v1','aaaaaaaa11'); localStorage.setItem('mtp_pair_v1',JSON.stringify({sid:'p',h:1,peer:'bbbbbbbb22',peerName:'あいて',topic:TOPIC,rk:SK,sk:SK,at:Date.now(),exp:Date.now()+9e9}));
   window.__srStarts=0; window.__dialogs=0;
   if(!withSR){ try{ delete window.webkitSpeechRecognition; }catch(e){} window.webkitSpeechRecognition=undefined; window.SpeechRecognition=undefined; return; }
   function R(){ this.lang=''; window.__sr=this; }
   R.prototype.start=function(){ window.__srStarts++; const me=this;
     if(mode==='deny'){ setTimeout(()=>{ me.onerror&&me.onerror({error:'not-allowed'}); me.onend&&me.onend(); },50); return; }
     const res=(arr)=>{ const r=arr.map(([t,f])=>{ const x=[{transcript:t}]; x.isFinal=f; return x; }); return {results:r}; };
     setTimeout(()=>me.onresult&&me.onresult(res([['あした',false]])),80);
     setTimeout(()=>me.onresult&&me.onresult(res([['明日は',true],['晴れるかな',false]])),160);
     me.__fin=setTimeout(()=>{ me.onresult&&me.onresult(res([['明日は',true],['晴れるかな',true]])); me.onend&&me.onend(); },mode==='long'?60000:260);
   };
   R.prototype.stop=function(){ clearTimeout(this.__fin); const me=this; setTimeout(()=>me.onend&&me.onend(),20); };
   R.prototype.abort=R.prototype.stop;
   window.webkitSpeechRecognition=R; window.SpeechRecognition=R; },{SK,TOPIC,withSR,mode});
 await ctx.route('**/*',r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')}); return r.abort();});
 const pg=await ctx.newPage(); pg.on('dialog',d=>{ pg.__dialogs=(pg.__dialogs||0)+1; d.accept(); });
 await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(2500);
 await pg.evaluate(()=>{ const S=__t.S; S.linked=true; S.sealed=true; S.paired=true; S.opp={id:'bbbbbbbb22',name:'相手'}; __t.show('play'); __t.setTab('chat'); const w=document.getElementById('storage-warning'); if(w) w.hidden=true; });
 await pg.waitForTimeout(300);
 return {ctx,pg};
}
const st=(pg)=>pg.evaluate(()=>{ const m=document.getElementById('btn-mic'), b=document.getElementById('btn-chat-send'), r=m&&m.getBoundingClientRect(), t=document.getElementById('in-chat').getBoundingClientRect(), sr=b.getBoundingClientRect();
  return {mic:!!m&&r.width>0,rec:!!m&&m.classList.contains('zg-rec'),inside:!!m&&r.right<=t.right+1&&r.left>t.left&&r.bottom<=t.bottom+1,besideSend:!!m&&r.left-t.left<30&&(function(){ const e=document.getElementById('btn-emo'); if(!e) return false; const er=e.getBoundingClientRect(); return er.right<=t.right+1&&sr.left-er.right<30&&er.left>r.right; })(),sendIsSend:!b.classList.contains('zg-mic')&&getComputedStyle(b.querySelector('.v439-send-label')).display!=='none',val:document.getElementById('in-chat').value,starts:window.__srStarts}; });
(async()=>{const b=await chromium.launch(); let all=true; const chk=(n,ok,x)=>{ console.log(n,JSON.stringify(x),ok?'OK':'NG'); if(!ok) all=false; };
 let {ctx,pg}=await open(b,true,'ok');
 let a=await st(pg); await pg.fill('#in-chat','こんにちは'); let c=await st(pg); await pg.fill('#in-chat','');
 chk('①マイクは入力欄の左端・右端は絵文字ボタン（v541）・送信はいつも送信',a.mic&&a.inside&&a.besideSend&&a.sendIsSend&&c.mic&&c.sendIsSend,{empty:a,typed:c});
 await pg.click('#btn-mic'); await pg.waitForTimeout(100); a=await st(pg); await pg.waitForTimeout(400); c=await st(pg);
 chk('②話した言葉が入り、絵文字が付く',pg.__dialogs===1&&a.rec&&c.val==='明日は晴れるかな☀️'&&!c.rec,{listening:a,done:c,dialogs:pg.__dialogs});
 const before=await pg.evaluate(()=>__t.S.chat.length);
 await pg.click('#btn-chat-send'); await pg.waitForTimeout(600); a=await st(pg);
 const sent=await pg.evaluate(()=>{ const m=__t.S.chat[__t.S.chat.length-1]; return {n:__t.S.chat.length,text:m&&m.text}; });
 chk('③送信ボタンで送る',sent.n===before+1&&sent.text==='明日は晴れるかな☀️'&&a.val===''&&a.starts===1,{sent,after:a});
 await ctx.close();
 ({ctx,pg}=await open(b,true,'long')); await pg.evaluate(()=>localStorage.setItem('zg_voice_ok','1'));
 await pg.fill('#in-chat','今日は');
 await pg.click('#btn-mic'); await pg.waitForTimeout(250); a=await st(pg); await pg.click('#btn-mic'); await pg.waitForTimeout(150); c=await st(pg);
 const n2=await pg.evaluate(()=>__t.S.chat.length);
 chk('④確認なし・続きに足す・もう一度押すと止まる（送らない）',!pg.__dialogs&&a.rec&&!c.rec&&c.val.startsWith('今日は')&&c.val.length>3&&n2===0,{listening:a,stopped:c,dialogs:pg.__dialogs||0,chat:n2});
 await ctx.close();
 ({ctx,pg}=await open(b,false,'')); await pg.click('#btn-mic'); await pg.waitForTimeout(200);
 a=await pg.evaluate(()=>({focus:document.activeElement&&document.activeElement.id,text:document.body.innerText.includes('キーボードのマイクボタン')}));
 chk('⑤音声認識が無い端末はキーボードのマイクを案内',a.focus==='in-chat'&&a.text,a);
 await ctx.close();
 ({ctx,pg}=await open(b,true,'deny')); await pg.evaluate(()=>localStorage.setItem('zg_voice_ok','1')); await pg.click('#btn-mic'); await pg.waitForTimeout(300);
 a=await pg.evaluate(()=>({text:document.body.innerText.includes('マイクが許可されていません'),rec:document.getElementById('btn-mic').classList.contains('zg-rec')}));
 chk('⑥マイク不許可のお知らせ',a.text&&!a.rec,a);
 await ctx.close();
 ({ctx,pg}=await open(b,true,'ok')); await pg.evaluate(()=>localStorage.setItem('zg_voice_ok','1'));
 await pg.evaluate(()=>document.getElementById('pf-voice-emo').click());
 const lab=await pg.evaluate(()=>document.getElementById('pf-voice-emo').textContent);
 await pg.click('#btn-mic'); await pg.waitForTimeout(500); a=await st(pg);
 chk('⑦設定で絵文字をオフにすると付かない',lab==='オフ'&&a.val==='明日は晴れるかな',{lab,val:a.val});
 await pg.evaluate(()=>document.getElementById('pf-voice-emo').click());
 const tbl=await pg.evaluate(()=>{ const f=window.__zgVoiceEmoji; return ['おはよう','ありがとう','ごめんね','大好きだよ','今から帰るね','お疲れさま','明日は雨やって','眠たいからもう寝るね','了解','今日はいい天気やね','もう絵文字😊'].map(t=>f(t)); });
 const want=['おはよう☀️','ありがとう🙏','ごめんね🙇','大好きだよ❤️','今から帰るね🏠','お疲れさま🍵','明日は雨やって☔','眠たいからもう寝るね😴','了解👍','今日はいい天気やね','もう絵文字😊'];
 chk('⑧絵文字の表',JSON.stringify(tbl)===JSON.stringify(want),tbl);
 await ctx.close();
 console.log(all?'OK: 音声入力':'NG'); await b.close(); process.exit(all?0:1);})();
