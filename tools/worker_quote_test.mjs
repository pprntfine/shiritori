// 日経平均・ドル円の前日比（worker/zatsugaku-push.js の quote）の試験。Yahoo・stooq の応答は作り物で、ネットには出ない。
// 使い方: node tools/worker_quote_test.mjs
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import {fileURLToPath,pathToFileURL} from 'node:url';
const src=fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'../worker/zatsugaku-push.js'),'utf8');
const body=src.slice(src.indexOf('async function getText(url) {'),src.indexOf('async function buildNews(prev) {'));
const tmp=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'zgq-')),'q.mjs'); fs.writeFileSync(tmp,body+'\nexport {quote,prevCloseOf};\n');
const {quote,prevCloseOf}=await import(pathToFileURL(tmp).href);
const JST=32400;
const day=(m,d,h=15)=>Date.UTC(2026,m-1,d,h-9,0)/1000;   // JST の h 時
function yahoo(bars,price,wrongPrev){ return {chart:{result:[{meta:{regularMarketPrice:price,regularMarketTime:bars[bars.length-1][0],gmtoffset:JST,chartPreviousClose:wrongPrev,previousClose:undefined},timestamp:bars.map(b=>b[0]),indicators:{quote:[{close:bars.map(b=>b[1])}]}}]}}; }
const mock=(m)=>{ globalThis.fetch=async(u)=>{ for(const [k,v] of m){ if(u.includes(k)){ if(v instanceof Error) throw v; return {ok:true,json:async()=>v,text:async()=>v}; } } throw new Error('no mock '+u); }; };
let ng=0; const eq=(n,a,b)=>{ const ok=Math.abs(a-b)<1e-6||(a===b); console.log(ok?'OK ':'NG ',n,a,'期待',b); if(!ok) ng++; };
// 1) 取引中: 5日分(11/12〜11/18)、今日は途中、5営業日前の終値は 50000（これを使ってはいけない）
const bars=[[day(11,12),50000],[day(11,13),50400],[day(11,14),50900],[day(11,17),51200],[day(11,18,12),50800]];
mock([['finance.yahoo.com',yahoo(bars,50800,49500)]]);
let q=await quote('^N225'); eq('取引中の前日比(11/17終値51200との差)',q.c,50800-51200); eq('%',+q.p.toFixed(4),+((50800-51200)/51200*100).toFixed(4));
// 2) 場が閉じた後: 最後の足が今日の終値
mock([['finance.yahoo.com',yahoo([...bars.slice(0,4),[day(11,18,15),50700]],50700,49500)]]);
q=await quote('^N225'); eq('閉場後の前日比',q.c,50700-51200);
// 3) 同じ日の足が2本（現在値用の重複）でも前日を取り違えない
mock([['finance.yahoo.com',yahoo([...bars,[day(11,18,13),50810]],50810,49500)]]);
q=await quote('^N225'); eq('同日の重複足',q.c,50810-51200);
// 4) 足が1日分しかない→差は出さない（誤った差を出さない）
mock([['finance.yahoo.com',yahoo([[day(11,18,12),50800]],50800,49500)]]);
q=await quote('^N225'); eq('足が足りない時は差なし',q.c,null);
// 5) 終値が null の足（休場日）は飛ばす
mock([['finance.yahoo.com',yahoo([[day(11,13),50400],[day(11,14),null],[day(11,17),51200],[day(11,18,12),50800]],50800,49500)]]);
q=await quote('^N225'); eq('nullの足を飛ばす',q.c,50800-51200);
// 6) ドル円（24時間）: UTC 日付ずれ。JST 基準の日付で分ける
const fx=[[Date.UTC(2026,10,16,22),150.10],[Date.UTC(2026,10,17,22),150.60],[Date.UTC(2026,10,18,3),150.90]];  // 11/17 07:00JST, 11/18 07:00JST, 11/18 12:00JST
mock([['finance.yahoo.com',yahoo(fx,150.90,148.0)]]);
q=await quote('JPY=X'); eq('ドル円(11/18朝の終値150.60との差)',+q.c.toFixed(4),+(150.90-150.60).toFixed(4));
// 7) 予備 stooq: Yahoo 失敗 → 現在値は l/、前日終値は日足
const csvL='Symbol,Date,Time,Open,High,Low,Close\n^NKX,2026-11-18,06:00:00,51000,51100,50500,50800\n';
const csvD='Date,Open,High,Low,Close\n2026-11-13,50000,50500,49900,50400\n2026-11-17,50900,51300,50800,51200\n2026-11-18,51000,51100,50500,50800\n';
mock([['finance.yahoo.com',new Error('down')],['stooq.com/q/l/',csvL],['stooq.com/q/d/l/',csvD]]);
q=await quote('^N225'); eq('予備: 前日(11/17)終値との差',q.c,50800-51200); eq('予備: 始値(51000)との差ではない',q.c!==50800-51000,true);
// 8) 予備の日足が取れない → 差なし（今日の始値との差は出さない）
mock([['finance.yahoo.com',new Error('down')],['stooq.com/q/l/',csvL],['stooq.com/q/d/l/',new Error('x')]]);
q=await quote('^N225'); eq('予備: 日足なしは差なし',q.c,null); eq('予備: 現在値は出る',q.v,50800);
console.log(ng?('NG '+ng+'件'):'全部 OK'); process.exit(ng?1:0);
