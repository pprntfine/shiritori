// v540: 中継所（Worker）に bell を添えてメッセージを置くと、Worker からも相手に通知（Web Push）が出る。bell が無い・ファイル・cache=no の時は出ない。
// 送り主のスマホの /push が失敗しても、メッセージが中継所に届けば通知が出る（二重の安全）。node で Worker を偽の Durable Object と偽の fetch で動かす。
// 使い方: node tools/worker_relay_push_test.mjs
const mod = await import(new URL('../worker/zatsugaku-push.js', import.meta.url));
const W = mod.default;
const kv = new Map(); const pubs = [];
const stubFor = name => ({ async fetch(input, init) {
  const req = input instanceof Request ? input : new Request(input, init);
  const u = new URL(req.url); const path = u.pathname.replace(/^\/+/, '');
  if (path === 'kv') { const j = await req.json(); const key = name + '|' + j.k;
    if (j.op === 'get') return Response.json({ v: kv.has(key) ? kv.get(key) : null });
    if (j.op === 'put') { kv.set(key, j.v); return Response.json({ ok: 1 }); }
    if (j.op === 'del') { kv.delete(key); return Response.json({ ok: 1 }); }
    if (j.op === 'add') { if (!kv.has(key)) kv.set(key, j.v); return Response.json({ v: kv.get(key) }); } }
  if (path === 'pub') { const t = await req.text(); pubs.push({ name, t, q: u.search }); return Response.json({ id: 'x', event: 'message', message: t }); }
  return Response.json({ error: 'nf' }, { status: 404 });
} });
const env = { RELAY: { idFromName: n => n, get: id => stubFor(id) } };
const waits = []; const ctx = { waitUntil: p => waits.push(p) };
// 相手の端末の通知の とうろく（本物の形の鍵）
const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
const b64u = a => Buffer.from(a).toString('base64url');
const BELL = 'gskb-' + 'a'.repeat(28);
const sub = { endpoint: 'https://push.example.test/send/abc', keys: { p256dh: b64u(raw), auth: b64u(crypto.getRandomValues(new Uint8Array(16))) } };
kv.set('b:' + BELL + '|subs', JSON.stringify([sub]));
// 外への fetch（通知サービス）を数える
const sent = []; const realFetch = globalThis.fetch;
globalThis.fetch = async (u, init) => { if (String(u).startsWith('https://push.example.test/')) { sent.push({ u: String(u), urg: init.headers.Urgency }); return new Response('', { status: 201 }); } return realFetch(u, init); };
const base = 'https://zatsugaku-push.pprnt908.workers.dev';
const post = async (q, body) => { waits.length = 0; const r = await W.fetch(new Request(base + '/r/gskr3s-test1234' + q, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body }), env, ctx); await Promise.all(waits); await Promise.all(waits); return r; };
let ok = true; const chk = (n, c, x) => { console.log(n, JSON.stringify(x), c ? 'OK' : 'NG'); if (!c) ok = false; };
const B1 = 'A'.repeat(200);
let r = await post('?bell=' + BELL, B1);
chk('bell 付きで置く → 置けた・相手に通知1回（Urgency high）', r.status === 200 && pubs.length === 1 && pubs[0].t === B1 && !/bell=/.test(pubs[0].q) && sent.length === 1 && sent[0].urg === 'high', { status: r.status, pubs: pubs.length, sent: sent.length });
r = await post('', B1); chk('bell なし → 通知は出さない（今までどおり）', r.status === 200 && pubs.length === 2 && sent.length === 1, { sent: sent.length });
r = await post('?bell=bad', B1); chk('bell の形が違う → 出さない', r.status === 200 && sent.length === 1, { sent: sent.length });
r = await post('?bell=' + BELL + '&cache=no', B1); chk('cache=no（送り直し）でも bell が付いていれば出す（付けるのはアプリが最初の1回だけ）', r.status === 200 && sent.length === 2, { sent: sent.length });
// /push は今までどおり
waits.length = 0; r = await W.fetch(new Request(base + '/push', { method: 'POST', body: JSON.stringify({ topic: BELL, msg: 'zgm:1:' + B1 }) }), env, ctx); const j = await r.json();
chk('/push は今までどおり（ok・sent 1）', j.ok === true && j.sent === 1 && sent.length === 3, j);
// 通知サービスが 410 → とうろくを外す
globalThis.fetch = async (u, init) => String(u).startsWith('https://push.example.test/') ? new Response('', { status: 410 }) : realFetch(u, init);
r = await post('?bell=' + BELL, B1); chk('通知サービスが「もう無い」と返したら、メッセージは置けて、とうろくは外す', r.status === 200 && !kv.get('b:' + BELL + '|subs'), { status: r.status });
console.log(ok ? 'OK: 中継所に置かれたメッセージは中継所からも通知が出る' : 'NG'); process.exit(ok ? 0 : 1);
