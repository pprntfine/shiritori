/* 雑学王 じぶん専用サーバー（Cloudflare Workers + Durable Objects）
   アプリの 設定「つうちサーバー」(zg_psrv) に この Worker の アドレスを 入れて つかう。

   ■ 通知（Web Push）
   - GET  /key   → {key, relay:1}    VAPID公開鍵（はじめて よばれた とき 自動で つくって しまう）
   - POST /sub   {topic, sub}        この 端末の とどけさき を とうろく
   - POST /push  {topic, msg}        そのトピックの 端末へ Web Push（RFC8291 aes128gcm + RFC8292 VAPID）

   ■ 最新ニュース
   - GET  /news  徳島・事件事故・株価（日経平均・ドル円）。1分ごとに 先に 取っておく（?fresh=1 で 今すぐ）

   ■ 中継所（ntfy.sh と 同じ 受け答え。1日250通の せいげんが ない）
   - POST /r/{topic}                     本文（暗号文）を おく
   - PUT  /r/{topic}?filename=&message=   ファイル（暗号化ずみ）を おく
   - GET  /r/{topic}/json?poll=1&since=T  T 以降の ぶんを 1行ずつ
   - GET  /r/{topic}/ws?since=T           WebSocket で ずっと うけとる
   - GET  /r/{topic}/file/{id}            ファイルを とる

   中身は すべて アプリで 暗号化ずみ。この サーバーは 読めない。12時間で 消える。
   必要な せってい: Durable Object（クラス ZgRelay）を 変数名 RELAY で バインド（wrangler.toml 参照）。
   前の 版の KV「SUBS」が つながって いれば、鍵と とうろくを ひきついで つかう（なくても うごく）。 */

const TOPIC_RE = /^gskb-[0-9a-f]{28}$/;          // 通知（ベル）用
const RELAY_TOPIC_RE = /^[A-Za-z0-9_-]{6,64}$/;   // 中継所の とおりみち
const MAX_SUBS = 4;            // 1トピックあたりの 端末数
const MAX_PLAIN = 3900;        // Web Push 本体 4096バイト − 暗号の 上乗せ
const MAX_MSG = 30000;         // /push で うけつける msg の 上限
const MAX_TEXT = 64 * 1024;    // 中継所の 本文 1通の 上限
const MAX_FILE = 2 * 1024 * 1024 + 64;   // ファイル 1こ の 上限（アプリは 2MB+28）
const KEEP_SEC = 12 * 3600;    // 中継所に のこす 時間
const DAY_LIMIT = 20000;       // 1とおりみち 1日の 上限（いたずら よけ）
// 2026-11-19: 1日に「保存」する数の上限（ブレーキ）。Durable Objects の書き込みは無料で1日10万行、保存1件で約5行（入れる4＋12時間後の削除1）。
// これを超えた分は保存せず、いまつながっている相手へ流すだけにする（中継所ごと止まるより良い。送った側はアプリが受領まで送り直す）。ふだんは1日数百件。
// 2026-11-19 持ち主の判断で「いったんはいらない」→ 既定は 0（ブレーキなし）。使う時は 8000 などにする。
const SOFT_STORE = 0;
const FILE_LIMIT = 300;        // 1とおりみちに 同時に おける ファイル数
const POLL_ROWS = 500;

const enc = new TextEncoder();
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Expose-Headers': 'Retry-After',
  'Access-Control-Max-Age': '86400',
};
function json(obj, status = 200, extra) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(extra || {}) },
  });
}

/* ---------- base64url ---------- */
function b64u(buf) {
  const a = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64u(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '==='.slice((s.length + 3) % 4));
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return a;
}
function concat(...parts) {
  const n = parts.reduce((t, p) => t + p.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function randId(n = 12) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const r = crypto.getRandomValues(new Uint8Array(n));
  let s = '';
  for (let i = 0; i < n; i++) s += A[r[i] % A.length];
  return s;
}

/* ---------- 小さな 保存場所（Durable Object の 中の kv 表） ---------- */
function box(env, name) {
  const stub = env.RELAY.get(env.RELAY.idFromName(name));
  const call = async (op, k, v) => {
    const r = await stub.fetch('https://do/kv', { method: 'POST', body: JSON.stringify({ op, k, v }) });
    return r.json();
  };
  return {
    async get(k) { const j = await call('get', k); return j.v == null ? null : JSON.parse(j.v); },
    async put(k, v) { await call('put', k, JSON.stringify(v)); },
    async del(k) { await call('del', k); },
    async putIfAbsent(k, v) { const j = await call('add', k, JSON.stringify(v)); return JSON.parse(j.v); },
  };
}

/* ---------- VAPID 鍵（1回だけ つくる） ---------- */
let vapidMem = null;
async function vapid(env) {
  if (vapidMem) return vapidMem;
  const cfg = box(env, 'cfg');
  let saved = await cfg.get('vapid');
  if ((!saved || !saved.jwk || !saved.pub) && env.SUBS) {
    // 前の 版（KV「SUBS」）の 鍵を ひきつぐ。かわると スマホの 通知とうろくが やりなおしに なる
    const old = await env.SUBS.get('__vapid', 'json');
    if (old && old.jwk && old.pub) saved = await cfg.putIfAbsent('vapid', { jwk: old.jwk, pub: old.pub });
  }
  if (!saved || !saved.jwk || !saved.pub) {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
    const pub = b64u(await crypto.subtle.exportKey('raw', kp.publicKey));
    // 同時に よばれても 鍵は 1つ（さきに 入った ほうを つかう）
    saved = await cfg.putIfAbsent('vapid', { jwk, pub });
  }
  const key = await crypto.subtle.importKey('jwk', saved.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  vapidMem = { pub: saved.pub, key, jwt: {} };
  return vapidMem;
}
async function vapidAuth(env, endpoint, subject) {
  const v = await vapid(env);
  const aud = new URL(endpoint).origin;
  const now = Math.floor(Date.now() / 1000);
  const c = v.jwt[aud];
  if (c && c.exp - now > 3600) return `vapid t=${c.t}, k=${v.pub}`;
  const exp = now + 12 * 3600;
  const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(enc.encode(JSON.stringify({ aud, exp, sub: subject })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, v.key, enc.encode(head + '.' + body));
  const t = head + '.' + body + '.' + b64u(sig);
  v.jwt[aud] = { t, exp };
  return `vapid t=${t}, k=${v.pub}`;
}

/* ---------- RFC8291 aes128gcm 暗号化 ---------- */
async function hkdf(salt, ikm, info, bytes) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, bytes * 8));
}
async function encryptPayload(sub, text) {
  const uaPub = unb64u(sub.keys.p256dh);
  const auth = unb64u(sub.keys.auth);
  const ua = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: ua }, eph.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const plain = concat(enc.encode(text), new Uint8Array([2]));   // 2 = さいごの レコード
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plain));
  const rs = new Uint8Array([0, 0, 16, 0]);                        // 4096
  return concat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}

/* ---------- とどけさき ---------- */
function validSub(s) {
  if (!s || typeof s !== 'object' || typeof s.endpoint !== 'string' || !s.keys) return false;
  let u; try { u = new URL(s.endpoint); } catch (e) { return false; }
  if (u.protocol !== 'https:' || s.endpoint.length > 1024) return false;
  try {
    if (unb64u(s.keys.p256dh).length !== 65) return false;
    if (unb64u(s.keys.auth).length !== 16) return false;
  } catch (e) { return false; }
  return true;
}
async function loadSubs(env, topic) {
  let a = await box(env, 'b:' + topic).get('subs');
  if (!Array.isArray(a) && env.SUBS) a = await env.SUBS.get('t:' + topic, 'json');   // 前の 版の とうろくを ひきつぐ
  return Array.isArray(a) ? a.filter(validSub) : [];
}

async function handleSub(req, env) {
  let j; try { j = await req.json(); } catch (e) { return json({ ok: false, err: 'bad json' }, 400); }
  const topic = j && j.topic;
  if (!TOPIC_RE.test(topic || '')) return json({ ok: false, err: 'bad topic' }, 400);
  const s = j.sub;
  if (!validSub(s)) return json({ ok: false, err: 'bad sub' }, 400);
  const clean = { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } };
  const list = await loadSubs(env, topic);
  const i = list.findIndex(x => x.endpoint === clean.endpoint);
  if (i >= 0 && list[i].keys.p256dh === clean.keys.p256dh && list[i].keys.auth === clean.keys.auth && i === list.length - 1) {
    return json({ ok: true, n: list.length });
  }
  if (i >= 0) list.splice(i, 1);
  list.push(clean);
  while (list.length > MAX_SUBS) list.shift();   // ふるい ものから はずす
  await box(env, 'b:' + topic).put('subs', list);
  return json({ ok: true, n: list.length });
}

function shrink(msg) {
  // 大きすぎる 本文は「しるし」に おきかえる（通知は 鳴る。本文は ふつうの 経路で とどく）
  if (enc.encode(msg).length <= MAX_PLAIN) return msg;
  const m = /^zgm:(\d+):/.exec(msg);
  return m ? 'zgm:' + m[1] + ':!' + Date.now().toString(36) : '💬';
}

async function handlePush(req, env, ctx) {
  let j; try { j = await req.json(); } catch (e) { return json({ ok: false, err: 'bad json' }, 400); }
  const topic = j && j.topic, raw = j && j.msg;
  if (!TOPIC_RE.test(topic || '')) return json({ ok: false, err: 'bad topic' }, 400);
  if (typeof raw !== 'string' || !raw || raw.length > MAX_MSG) return json({ ok: false, err: 'bad msg' }, 400);
  return json(await pushTopic(env, ctx, topic, raw, new URL(req.url).origin));
}

/* v540: 通知を送る本体（/push と、中継所にメッセージが置かれた時の両方から使う） */
async function pushTopic(env, ctx, topic, raw, subject) {
  const list = await loadSubs(env, topic);
  if (!list.length) return { ok: false, err: 'no subscriber', sent: 0 };
  const msg = shrink(raw);
  const isCall = /^zgcall:/.test(msg);
  const gone = [];
  const why = [];
  let sent = 0;
  await Promise.all(list.map(async s => {
    try {
      const body = await encryptPayload(s, msg);
      const r = await fetch(s.endpoint, {
        method: 'POST',
        headers: {
          Authorization: await vapidAuth(env, s.endpoint, subject),
          'Content-Encoding': 'aes128gcm',
          'Content-Type': 'application/octet-stream',
          TTL: isCall ? '60' : '86400',
          Urgency: 'high',
        },
        body,
      });
      if (r.status >= 200 && r.status < 300) sent++;
      else {
        why.push(r.status);
        if (r.status === 404 || r.status === 410) gone.push(s.endpoint);   // もう つかわれて いない 端末
      }
    } catch (e) { why.push('net'); }
  }));
  if (gone.length) {
    const keep = list.filter(s => !gone.includes(s.endpoint));
    const b = box(env, 'b:' + topic);
    const p = keep.length ? b.put('subs', keep) : b.del('subs');
    if (ctx && ctx.waitUntil) ctx.waitUntil(p); else await p;
  }
  if (!sent) {
    const left = list.length - gone.length;
    return { ok: false, sent: 0, err: left ? 'push failed ' + why.join(',') : 'no subscriber' };
  }
  return { ok: true, sent, send: sent, small: msg !== raw ? 1 : 0 };
}

/* ---------- 中継所 ---------- */
async function handleRelay(req, env, parts, ctx) {
  const topic = parts[0];
  if (!RELAY_TOPIC_RE.test(topic || '')) return json({ error: 'bad topic' }, 400);
  const stub = env.RELAY.get(env.RELAY.idFromName('r:' + topic));
  const url = new URL(req.url);
  const rest = parts.slice(1).join('/');
  const inner = new URL('https://do/' + (rest || 'pub') + url.search);
  inner.searchParams.set('topic', topic);
  inner.searchParams.set('origin', url.origin);
  // v540: メッセージを置く時に、送り主が相手の通知の とおりみち（bell）を添えていたら、ここからも相手に通知を送る。
  // 送り主のスマホが別に頼む通知（/push）が途中で失敗しても、メッセージが中継所に届けば通知は必ず出る（同じ暗号文なので、
  // 2つ届いても受け取る側の sw.js が2回目を鳴らさない）。
  const bell = url.searchParams.get('bell') || '';
  inner.searchParams.delete('bell');
  let r, text = null;
  if (req.method === 'POST' && !rest && TOPIC_RE.test(bell) && !url.searchParams.get('filename')) {
    text = await req.text();
    r = await stub.fetch(new Request(inner.toString(), { method: 'POST', headers: req.headers, body: text }));
    if (r.ok && text && text.length <= MAX_MSG) {
      const p = pushTopic(env, ctx, bell, 'zgm:0:' + text, url.origin).catch(() => {});
      if (ctx && ctx.waitUntil) ctx.waitUntil(p); else await p;
    }
  } else {
    r = await stub.fetch(new Request(inner.toString(), req));
  }
  if (r.status === 101) return r;
  const h = new Headers(r.headers);
  Object.entries(CORS).forEach(([k, v]) => h.set(k, v));
  return new Response(r.body, { status: r.status, headers: h });
}

/* ---------- 最新ニュース（トップ画面用） ----------
   アプリを ひらく たびに よばれる。ニュースの サイトへは この サーバーが 取りに いく
   （スマホは ニュースの サイトに 直接 つながらない）。5分 おぼえて おいて、それより 古ければ 取りなおす。 */
const NEWS_TTL = 45 * 1000;          // これより 新しければ そのまま かえす
const NEWS_STALE = 60 * 60 * 1000;   // これより 古く なければ、古い ものを すぐ かえして 裏で 取りなおす
const NEWS_FORCE_GAP = 15 * 1000;    // 「↻」を れんだ されても 15秒に 1回 まで
const GN = q => 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=ja&gl=JP&ceid=JP:ja';
const NEWS_SRC = {
  tokushima: [GN('徳島 when:2d'), GN('徳島')],
  jiken: ['https://www.nhk.or.jp/rss/news/cat1.xml', GN('事件 OR 事故 when:1d')],
  keizai: [GN('株価 OR 日経平均 when:1d'), 'https://www.nhk.or.jp/rss/news/cat5.xml'],
};
const NEWS_MAX = { tokushima: 12, jiken: 8, keizai: 6 };
let newsMem = null;

function xmlText(s) {
  s = String(s || '').replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  return s.replace(/\s+/g, ' ').trim();
}
function tag(block, name) {
  const m = new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'i').exec(block);
  return m ? xmlText(m[1]) : '';
}
function parseRss(xml) {
  const out = [];
  const re = /<item[\s>][\s\S]*?<\/item>/gi;
  let m;
  while ((m = re.exec(xml)) && out.length < 40) {
    const b = m[0];
    let t = tag(b, 'title'), src = tag(b, 'source');
    const u = tag(b, 'link');
    if (src && t.endsWith(' - ' + src)) t = t.slice(0, -(' - ' + src).length);
    const d = Date.parse(tag(b, 'pubDate')) || 0;
    if (!t || !/^https:\/\//.test(u)) continue;
    out.push({ t: t.slice(0, 120), u: u.slice(0, 600), s: (src || '').slice(0, 30), d });
  }
  return out;
}
async function getText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (zatsugaku-news)', Accept: '*/*' }, signal: AbortSignal.timeout(4000), cf: { cacheTtl: 30 } });
  if (!r.ok) throw new Error('http ' + r.status);
  return r.text();
}
async function newsGroup(key) {
  for (const url of NEWS_SRC[key]) {
    try {
      const items = parseRss(await getText(url));
      if (!items.length) continue;
      if (!url.includes('nhk.or.jp')) items.sort((a, b) => b.d - a.d);
      const seen = new Set(), list = [];
      for (const it of items) { const k = it.t.replace(/\s/g, ''); if (seen.has(k)) continue; seen.add(k); list.push(it); if (list.length >= NEWS_MAX[key]) break; }
      return list;
    } catch (e) {}
  }
  return [];
}
/* 前日比の「前日」を、日ごとの終値の並びから決める（日付ごとに最後の終値だけを残し、いちばん新しい日の1つ前）。
   2026-11-18 直し: 以前は meta.chartPreviousClose を使っていたが、range=5d ではこれは「5日分の範囲の1つ前の終値」（約5営業日前）で、前日比にならなかった */
function prevCloseOf(j) {
  const r = j.chart.result[0], ts = r.timestamp || [], cl = (r.indicators.quote[0] || {}).close || [];
  const off = (r.meta && r.meta.gmtoffset) || 0;
  const byDay = new Map();
  for (let i = 0; i < ts.length; i++) {
    if (typeof cl[i] !== 'number' || !isFinite(cl[i])) continue;
    byDay.set(new Date((ts[i] + off) * 1000).toISOString().slice(0, 10), cl[i]);   // 同じ日は後のもので上書き
  }
  const days = [...byDay.keys()].sort();
  return days.length >= 2 ? byDay.get(days[days.length - 2]) : null;
}
async function quote(sym) {
  try {
    const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=1d&range=5d',
      { headers: { 'User-Agent': 'Mozilla/5.0 (zatsugaku-news)' }, signal: AbortSignal.timeout(4000) });
    const j = await r.json();
    const meta = j.chart.result[0].meta;
    const v = meta.regularMarketPrice, p = prevCloseOf(j);
    if (typeof v !== 'number') throw 0;
    return { v, c: typeof p === 'number' ? v - p : null, p: typeof p === 'number' && p ? (v - p) / p * 100 : null, at: (meta.regularMarketTime || 0) * 1000 };
  } catch (e) {}
  try {   // 予備（stooq）: 現在値は l/、前日の終値は日足 d/l から（以前は「今日の始値」との差で、前日比ではなかった）
    const st = { '^N225': '^nkx', 'JPY=X': 'usdjpy' }[sym];
    const t = await getText('https://stooq.com/q/l/?s=' + encodeURIComponent(st) + '&f=sd2t2ohlc&h&e=csv');
    const row = t.trim().split('\n')[1].split(',');
    const v = parseFloat(row[6]);
    if (!isFinite(v)) throw 0;
    let pc = NaN;
    try {
      const d1 = new Date(Date.now() - 12 * 86400 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
      const h = (await getText('https://stooq.com/q/d/l/?s=' + encodeURIComponent(st) + '&i=d&d1=' + d1)).trim().split('\n').slice(1).map(l => l.split(','));
      const older = h.filter(x => x[0] < row[1] && isFinite(parseFloat(x[4])));   // 現在値の日より前の、いちばん新しい終値
      if (older.length) pc = parseFloat(older[older.length - 1][4]);
    } catch (e) {}
    return { v, c: isFinite(pc) ? v - pc : null, p: isFinite(pc) && pc ? (v - pc) / pc * 100 : null, at: Date.parse(row[1] + 'T' + row[2] + 'Z') || 0, open: 1 };
  } catch (e) {}
  return null;
}
async function buildNews(prev) {
  const [tokushima, jiken, keizai, nikkei, usdjpy] = await Promise.all([
    newsGroup('tokushima'), newsGroup('jiken'), newsGroup('keizai'), quote('^N225'), quote('JPY=X'),
  ]);
  const pm = (prev && prev.market) || {};
  // 一部が とれなかった ときは、前の ぶんで うめる（空に しない）
  return {
    at: Date.now(),
    tokushima: tokushima.length ? tokushima : (prev && prev.tokushima) || [],
    jiken: jiken.length ? jiken : (prev && prev.jiken) || [],
    keizai: keizai.length ? keizai : (prev && prev.keizai) || [],
    market: { nikkei: nikkei || pm.nikkei || null, usdjpy: usdjpy || pm.usdjpy || null },
    got: tokushima.length + jiken.length + keizai.length,
  };
}
let newsBusy = null;
async function refreshNews(env) {
  if (newsBusy) return newsBusy;   // 同時に 何本も 取りに いかない
  newsBusy = (async () => {
    const b = box(env, 'news');
    let prev = newsMem;
    if (!prev) { try { prev = await b.get('v'); } catch (e) {} }
    const fresh = await buildNews(prev);
    if (!fresh.got) return prev || null;
    delete fresh.got;
    newsMem = fresh;
    try { await b.put('v', fresh); } catch (e) {}
    return fresh;
  })().finally(() => { newsBusy = null; });
  return newsBusy;
}
async function handleNews(req, env, ctx) {
  const now = Date.now();
  const force = new URL(req.url).searchParams.get('fresh') === '1';
  let saved = newsMem;
  if (!saved) { try { saved = await box(env, 'news').get('v'); if (saved) newsMem = saved; } catch (e) {} }
  const age = saved ? now - saved.at : Infinity;
  if (saved && age < (force ? NEWS_FORCE_GAP : NEWS_TTL)) return json({ ok: true, ...saved });
  if (saved && age < NEWS_STALE && !force) {
    // 古い ものを すぐ かえして、裏で あたらしく する（待たせない）
    const p = refreshNews(env);
    if (ctx && ctx.waitUntil) ctx.waitUntil(p);
    return json({ ok: true, ...saved });
  }
  const fresh = await refreshNews(env);
  if (fresh) return json({ ok: true, ...fresh });
  if (saved) return json({ ok: true, stale: 1, ...saved });
  return json({ ok: false, err: 'news unavailable' }, 502);
}

export class ZgRelay {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v TEXT)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS m(seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE, t INTEGER, msg TEXT, an TEXT, asz INTEGER)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS m_t ON m(t)');
    // 2026-11-17: 写真の数を数える時に全件を読まない（Durable Objects の1日の読み出し上限 rows_read 500万を超えて止まった）
    this.sql.exec('CREATE INDEX IF NOT EXISTS m_an ON m(an) WHERE an IS NOT NULL');
    this.sql.exec('CREATE TABLE IF NOT EXISTS f(id TEXT, part INTEGER, b BLOB, PRIMARY KEY(id, part))');
  }

  kvGet(k) { const r = this.sql.exec('SELECT v FROM kv WHERE k=?', k).toArray(); return r.length ? r[0].v : null; }
  kvPut(k, v) { this.sql.exec('INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v', k, v); }

  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/+/, '');
    if (path === 'kv') {
      const j = await req.json();
      if (j.op === 'get') return Response.json({ v: this.kvGet(j.k) });
      if (j.op === 'put') { this.kvPut(j.k, j.v); return Response.json({ ok: 1 }); }
      if (j.op === 'del') { this.sql.exec('DELETE FROM kv WHERE k=?', j.k); return Response.json({ ok: 1 }); }
      if (j.op === 'add') { const have = this.kvGet(j.k); if (have == null) { this.kvPut(j.k, j.v); return Response.json({ v: j.v }); } return Response.json({ v: have }); }
      return Response.json({ err: 'op' }, { status: 400 });
    }
    const topic = url.searchParams.get('topic') || '';
    const origin = url.searchParams.get('origin') || '';
    if ((path === 'pub' || path === '') && (req.method === 'POST' || req.method === 'PUT')) return this.publish(req, url, topic, origin);
    if (path === 'json' && req.method === 'GET') return this.poll(url);
    if (path === 'ws' && req.method === 'GET') return this.ws(req, url);
    if (path.startsWith('file/') && req.method === 'GET') return this.file(path.slice(5));
    return Response.json({ error: 'not found' }, { status: 404 });
  }

  since(url) {
    const s = url.searchParams.get('since') || '';
    if (s === 'all') return 0;
    if (/^\d{1,12}$/.test(s)) return parseInt(s, 10);
    return Math.floor(Date.now() / 1000) - KEEP_SEC;
  }

  rows(since) {
    const cut = Math.floor(Date.now() / 1000) - KEEP_SEC;
    // 2026-11-17: ORDER BY seq だと索引 m_t が使われず、5秒ごとの取りに来るたびに12時間分を全部読んでいた（rows_read 上限超え）。
    // t の索引の順（t, seq）で読めば、since より新しい分だけを読む。
    return this.sql.exec('SELECT id,t,msg,an,asz FROM m WHERE t>=? AND t>=? ORDER BY t, seq LIMIT ?', since, cut, POLL_ROWS).toArray();
  }

  event(row, topic, origin) {
    const ev = { id: row.id, time: row.t, expires: row.t + KEEP_SEC, event: 'message', topic, message: row.msg };
    if (row.an) ev.attachment = { name: row.an, type: 'application/octet-stream', size: row.asz, expires: row.t + KEEP_SEC, url: origin + '/r/' + topic + '/file/' + row.id };
    return ev;
  }

  async publish(req, url, topic, origin) {
    const now = Math.floor(Date.now() / 1000);
    const day = 'cnt:' + new Date().toISOString().slice(0, 10);
    // 2026-11-17: 1通ごとに数を保存すると書き込み（rows_written、無料は1日10万）が増えるので、メモリで数えて20通ごとに保存する
    if (!this.cnt || this.cnt.day !== day) { const v0 = String(this.kvGet(day) || '0').split('|'); const n0 = parseInt(v0[0], 10) || 0; this.cnt = { day, n: n0, s: parseInt(v0[1] || '0', 10) || 0, saved: n0 }; }
    const used = this.cnt.n;
    if (used >= DAY_LIMIT) return Response.json({ error: 'daily limit' }, { status: 429, headers: { 'Retry-After': '600' } });
    const len = parseInt(req.headers.get('content-length') || '0', 10);
    const filename = url.searchParams.get('filename');
    let msg, bytes = null;
    if (filename) {
      if (len > MAX_FILE) return Response.json({ error: 'too large' }, { status: 413 });
      bytes = new Uint8Array(await req.arrayBuffer());
      if (bytes.length > MAX_FILE || !bytes.length) return Response.json({ error: 'too large' }, { status: 413 });
      const files = this.sql.exec('SELECT COUNT(*) AS n FROM m WHERE an IS NOT NULL').one().n;
      if (files >= FILE_LIMIT) return Response.json({ error: 'too many files' }, { status: 429, headers: { 'Retry-After': '600' } });
      msg = url.searchParams.get('message') || url.searchParams.get('m') || '';
    } else {
      if (len > MAX_TEXT) return Response.json({ error: 'too large' }, { status: 413 });
      msg = await req.text();
    }
    if (msg.length > MAX_TEXT) return Response.json({ error: 'too large' }, { status: 413 });
    this.cnt.n = used + 1;
    if (this.cnt.n - this.cnt.saved >= 20) { this.kvPut(day, this.cnt.n + '|' + this.cnt.s); this.cnt.saved = this.cnt.n; }
    const row = { id: randId(), t: now, msg, an: bytes ? String(filename).slice(0, 64) : null, asz: bytes ? bytes.length : 0 };
    const sv = parseInt((this.env && this.env.SOFT_STORE) || '', 10), soft = Number.isFinite(sv) ? sv : SOFT_STORE;
    const keep = bytes || ((url.searchParams.get('cache') || '').toLowerCase() !== 'no' && (soft <= 0 || this.cnt.s < soft));
    if (keep) {
      this.cnt.s++;
      this.sql.exec('INSERT INTO m(id,t,msg,an,asz) VALUES(?,?,?,?,?)', row.id, row.t, row.msg, row.an, row.asz);
      if (bytes) {
        const CH = 1024 * 1024;   // 1行 2MBまで なので 1MBずつ
        for (let p = 0, i = 0; p < bytes.length; p += CH, i++) this.sql.exec('INSERT INTO f(id,part,b) VALUES(?,?,?)', row.id, i, bytes.slice(p, p + CH));
      }
      if ((await this.ctx.storage.getAlarm()) == null) await this.ctx.storage.setAlarm(Date.now() + 3600 * 1000);
    }
    const ev = this.event(row, topic, origin);
    const line = JSON.stringify(ev);
    for (const ws of this.ctx.getWebSockets()) { try { ws.send(line); } catch (e) {} }
    return Response.json(ev);
  }

  poll(url) {
    const topic = url.searchParams.get('topic'), origin = url.searchParams.get('origin');
    const out = this.rows(this.since(url)).map(r => JSON.stringify(this.event(r, topic, origin))).join('\n');
    return new Response(out ? out + '\n' : '', { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' } });
  }

  ws(req, url) {
    if ((req.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') return Response.json({ error: 'need websocket' }, { status: 426 });
    const topic = url.searchParams.get('topic'), origin = url.searchParams.get('origin');
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    if (this.ctx.getWebSockets().length >= 16) { try { this.ctx.getWebSockets()[0].close(1000, 'too many'); } catch (e) {} }
    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify({ id: randId(), time: Math.floor(Date.now() / 1000), event: 'open', topic }));
    for (const r of this.rows(this.since(url))) server.send(JSON.stringify(this.event(r, topic, origin)));
    return new Response(null, { status: 101, webSocket: client });
  }
  webSocketMessage(ws, msg) {
    if (msg === 'ping') { try { ws.send(JSON.stringify({ event: 'keepalive', time: Math.floor(Date.now() / 1000) })); } catch (e) {} }
  }
  webSocketClose(ws, code) { try { ws.close(code === 1005 ? 1000 : code); } catch (e) {} }
  webSocketError(ws) { try { ws.close(1011); } catch (e) {} }

  file(id) {
    if (!/^[A-Za-z0-9]{12}$/.test(id)) return Response.json({ error: 'bad id' }, { status: 400 });
    const cut = Math.floor(Date.now() / 1000) - KEEP_SEC;
    const meta = this.sql.exec('SELECT asz FROM m WHERE id=? AND an IS NOT NULL AND t>=?', id, cut).toArray();
    if (!meta.length) return Response.json({ error: 'not found' }, { status: 404 });
    const parts = this.sql.exec('SELECT b FROM f WHERE id=? ORDER BY part', id).toArray().map(r => new Uint8Array(r.b));
    const all = concat(...parts);
    return new Response(all, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(all.length), 'Cache-Control': 'no-store' } });
  }

  async alarm() {
    const cut = Math.floor(Date.now() / 1000) - KEEP_SEC;
    this.sql.exec('DELETE FROM f WHERE id IN (SELECT id FROM m WHERE t<?)', cut);
    this.sql.exec('DELETE FROM m WHERE t<?', cut);
    this.sql.exec("DELETE FROM kv WHERE k LIKE 'cnt:%' AND k<?", 'cnt:' + new Date(Date.now() - 2 * 86400 * 1000).toISOString().slice(0, 10));
    const left = this.sql.exec('SELECT COUNT(*) AS n FROM m').one().n;
    if (left) await this.ctx.storage.setAlarm(Date.now() + 3600 * 1000);
  }
}

export default {
  // 1分ごとに ニュースを 先に 取っておく（アプリが ひらいた とき すぐ だせる）
  async scheduled(event, env, ctx) { if (env.RELAY) ctx.waitUntil(refreshNews(env)); },
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (!env.RELAY) return json({ ok: false, err: 'Durable Object RELAY is not bound' }, 500);
    const path = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
    try {
      if (path.startsWith('/r/')) return await handleRelay(req, env, path.slice(3).split('/'), ctx);
      if (path === '/key' && req.method === 'GET') return json({ key: (await vapid(env)).pub, relay: 1 });
      if (path === '/news' && req.method === 'GET') return await handleNews(req, env, ctx);
      if (path === '/sub' && req.method === 'POST') return await handleSub(req, env);
      if (path === '/push' && req.method === 'POST') return await handlePush(req, env, ctx);
      if (path === '/') return json({ ok: true, app: 'zatsugaku-push', relay: 1 });
      return json({ ok: false, err: 'not found' }, 404);
    } catch (e) {
      return json({ ok: false, err: 'server error' }, 500);
    }
  },
};
