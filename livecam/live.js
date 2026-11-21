// 「今配信中」を集める（Cloudflare Worker の中で動く。/live.json）
// ツイキャスの外配信・車載、ニコ生のお散歩系、YouTube のお散歩ライブ。
// 配信は数時間で終わるので一覧に固定せず、開いた時にその場で集める（3分覚えておく）。
const LIVE_UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const LIVE_UA_SP='Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const NICO_OK=/外配信|散歩|さんぽ|おさんぽ|街|駅|ドライブ|自転車|チャリ|旅|ライド|釣り|歩|周辺|お出かけ|ツーリング|バイク|車載|観光|海|山|川|公園|祭|夜景|電車|鉄道|ぶらり|うろうろ|うろちょろ/;
const NICO_NG=/歌枠|ラジオ|RADIO|ゲーム|雑談のみ|作業|声劇|占い|ASMR|麻雀|将棋|囲碁|パチ|スロット/i;
function unent(s){return s.replace(/&quot;/g,'"').replace(/&#039;|&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')}
async function liveGet(u,sp){
  const r=await fetch(u,{headers:{'user-agent':sp?LIVE_UA_SP:LIVE_UA,'accept-language':'ja,en;q=0.5'},cf:{cacheTtl:60}});
  if(!r.ok)throw new Error('http '+r.status);return await r.text();
}
async function liveTc(genre,label){
  const t=await liveGet('https://twitcasting.tv/?genre='+genre,true);
  const out=[],seen={};
  const re=/href="\/([A-Za-z0-9_:]+)\/movie\/(\d+)"\s+class="\s*tw-movie-sp"/g;let m;
  while((m=re.exec(t))){
    if(seen[m[1]])continue;seen[m[1]]=1;
    const c=t.slice(m.index,m.index+4000);
    const th=(c.match(/tw-movie-sp-image-body"[^>]*src="([^"]+)"/)||[])[1]||'';
    const telop=((c.match(/tw-movie-sp-telop">([^<]*)</)||[])[1]||'').trim();
    const name=((c.match(/tw-movie-sp-name">([^<]*)</)||[])[1]||'').trim();
    const sub=((c.match(/tw-movie-sp-title">([^<]*)</)||[])[1]||'').trim();
    out.push({s:'tc',id:m[1],t:unent(telop||sub||name),u:unent(name),th:th.indexOf('https://')===0?th:'',url:'https://twitcasting.tv/'+m[1],g:label});
  }
  return out;
}
async function liveNico(word){
  const t=await liveGet('https://live.nicovideo.jp/search?keyword='+encodeURIComponent(word)+'&status=onair&sortOrder=recentDesc');
  let j=null;const re=/data-props="([^"]+)"/g;let m;
  while((m=re.exec(t))){if(m[1].indexOf('statusData')<0)continue;try{j=JSON.parse(unent(m[1]))}catch(e){}if(j)break}
  if(!j)return [];
  const sd=(j.searchResult&&j.searchResult.statusData)||j.statusData||{};const ps=(sd.onair&&sd.onair.programs)||[];
  const out=[];
  ps.forEach(o=>{
    const id=o.nicoliveProgramId;if(!id||!/^lv\d+$/.test(id)||o.isFollowerOnly||o.payment)return;
    const th=o.listingThumbnail||'';
    out.push({s:'nico',id,t:o.title||'',d:o.description||'',u:(o.supplier&&o.supplier.name)||'',th:th.indexOf('https://')===0?th:'',url:'https://live.nicovideo.jp/watch/'+id});
  });
  return out.filter(x=>NICO_OK.test(x.t+' '+x.d)&&!NICO_NG.test(x.t)).map(x=>{delete x.d;return x});
}
async function liveYt(q){
  const t=await liveGet('https://www.youtube.com/results?search_query='+encodeURIComponent(q)+'&sp=EgJAAQ%253D%253D&hl=ja&gl=JP');
  const out=[];
  for(const p of t.split('"videoRenderer"').slice(1)){
    const c=p.slice(0,9000);
    const id=(c.match(/"videoId":"([A-Za-z0-9_-]{11})"/)||[])[1];if(!id)continue;
    if(!/BADGE_STYLE_TYPE_LIVE_NOW|"label":"LIVE"|ライブ中/.test(c))continue;
    let title=(c.match(/"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/)||[])[1]||'';
    try{title=JSON.parse('"'+title+'"')}catch(e){}
    let ch=(c.match(/"ownerText":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/)||[])[1]||'';
    try{ch=JSON.parse('"'+ch+'"')}catch(e){}
    if(/ゲーム|実況|作業用|睡眠|ASMR|BGM|ニュース|歌枠|雑談/.test(title))continue;
    out.push({s:'yt',id,t:title,u:ch,th:'https://i.ytimg.com/vi/'+id+'/hqdefault_live.jpg',url:'https://www.youtube.com/watch?v='+id});
  }
  return out;
}
async function liveCollect(){
  const jobs=[
    liveTc('streamers_outdoor','外配信'),liveTc('relay_car_jp','車載'),
    liveNico('外配信'),liveNico('散歩'),liveNico('街歩き'),liveNico('ドライブ'),liveNico('自転車'),
    liveYt('お散歩ライブ'),liveYt('街歩き ライブ 日本'),liveYt('散歩 生配信'),liveYt('japan walk live'),liveYt('ドライブ ライブ配信')
  ];
  const res=await Promise.allSettled(jobs.map(j=>Promise.race([j,new Promise((_,rj)=>setTimeout(()=>rj(new Error('timeout')),8000))])));
  const items=[],seen={},errs=[];
  res.forEach((r,i)=>{if(r.status!=='fulfilled'){errs.push(i+':'+String(r.reason&&r.reason.message||r.reason));return}
    r.value.forEach(x=>{const k=x.s+':'+x.id;if(seen[k])return;seen[k]=1;items.push(x)})});
  return {at:Date.now(),items,errs};
}
async function liveJson(req,ctx){
  const cache=caches.default,key=new Request('https://livecam.cache/live.json?v=1');
  let hit=await cache.match(key);
  if(hit)return new Response(hit.body,{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-cache','x-live-cache':'hit'}});
  const body=JSON.stringify(await liveCollect());
  const resp=new Response(body,{headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=180'}});
  ctx.waitUntil(cache.put(key,resp.clone()));
  return new Response(body,{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-cache','x-live-cache':'miss'}});
}
if(typeof module!=='undefined')module.exports={liveTc,liveNico,liveYt,liveCollect};
