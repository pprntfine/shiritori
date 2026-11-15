/* 雑学王 つうちサーバー（Cloudflare Workers）
   アプリの 設定「つうちサーバー」(zg_psrv) に この Worker の アドレスを 入れて つかう。
   - GET  /key   → {key}            VAPID公開鍵（はじめて よばれた とき 自動で つくって KV に しまう）
   - POST /sub   {topic, sub}       この 端末の とどけさき を とうろく
   - POST /push  {topic, msg}       そのトピックの 端末へ Web Push（RFC8291 aes128gcm + RFC8292 VAPID）
   本文は アプリで 暗号化ずみ（zgm:N:暗号文）。この Worker は 中身を 読めないし 保存も しない。
   保存するのは「トピック → 端末の とどけさき」と VAPID鍵 だけ。
   必要な せってい: KV namespace を 変数名 ZG で バインド する。 */

const TOPIC_RE = /^gskb-[0-9a-f]{28}$/;
const MAX_SUBS = 4;          // 1トピック(=1人)あたりの 端末数
const MAX_PLAIN = 3900;      // Web Push の 本体は 4096バイトまで。暗号の 上乗せ分を 引いた 安全な 値
const MAX_MSG = 30000;       // うけつける msg の 上限（大きい ものは しるしに おきかえる）

const enc = new TextEncoder();
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
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

/* ---------- VAPID 鍵（KV に 1回だけ つくる） ---------- */
let vapidMem = null;
async function vapid(env) {
  if (vapidMem) return vapidMem;
  let saved = await env.ZG.get('vapid', 'json');
  if (!saved || !saved.jwk || !saved.pub) {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
    const pub = b64u(await crypto.subtle.exportKey('raw', kp.publicKey));
    saved = { jwk, pub };
    await env.ZG.put('vapid', JSON.stringify(saved));
    // 同時に よばれて 別の 鍵が できた ときは、KV に のこった ほうに そろえる
    const again = await env.ZG.get('vapid', 'json');
    if (again && again.pub) saved = again;
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

/* ---------- とどけさき の 保存 ---------- */
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
  const a = await env.ZG.get('t:' + topic, 'json');
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
  // 同じ ものは 書かない（KV の 書きこみ回数を ふやさない）
  if (i >= 0 && list[i].keys.p256dh === clean.keys.p256dh && list[i].keys.auth === clean.keys.auth && i === list.length - 1) {
    return json({ ok: true, n: list.length });
  }
  if (i >= 0) list.splice(i, 1);
  list.push(clean);
  while (list.length > MAX_SUBS) list.shift();   // ふるい ものから はずす
  await env.ZG.put('t:' + topic, JSON.stringify(list));
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
  const list = await loadSubs(env, topic);
  if (!list.length) return json({ ok: false, err: 'no subscriber', sent: 0 });
  const msg = shrink(raw);
  const isCall = /^zgcall:/.test(msg);
  const subject = new URL(req.url).origin;
  const gone = [];
  let sent = 0;
  const why = [];
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
    const p = keep.length ? env.ZG.put('t:' + topic, JSON.stringify(keep)) : env.ZG.delete('t:' + topic);
    if (ctx && ctx.waitUntil) ctx.waitUntil(p); else await p;
  }
  if (!sent) {
    const left = list.length - gone.length;
    return json({ ok: false, sent: 0, err: left ? 'push failed ' + why.join(',') : 'no subscriber' });
  }
  return json({ ok: true, sent, send: sent, small: msg !== raw ? 1 : 0 });
}

export default {
  async fetch(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (!env.ZG) return json({ ok: false, err: 'KV namespace ZG is not bound' }, 500);
    const path = new URL(req.url).pathname.replace(/\/+$/, '') || '/';
    try {
      if (path === '/key' && req.method === 'GET') return json({ key: (await vapid(env)).pub });
      if (path === '/sub' && req.method === 'POST') return await handleSub(req, env);
      if (path === '/push' && req.method === 'POST') return await handlePush(req, env, ctx);
      if (path === '/') return json({ ok: true, app: 'zatsugaku-push' });
      return json({ ok: false, err: 'not found' }, 404);
    } catch (e) {
      return json({ ok: false, err: 'server error' }, 500);
    }
  },
};
