// 手元の「にせ ntfy.sh」と「にせ 公開MQTT」（試験用。本物のスマホと同じく、即時路 MQTT と ntfy がつながった状態を作る）。
// 使い方: node tools/fake_net.js  （127.0.0.2:443 = ntfy.sh、127.0.0.3:8884/8084 = HiveMQ/EMQX）
// chromium は --host-resolver-rules で ntfy.sh→127.0.0.2、broker.hivemq.com・broker.emqx.io→127.0.0.3 に向け、--ignore-certificate-errors を付ける。
// 数: GET https://127.0.0.2/__stats で、ntfy への POST 数・SSE 接続数・MQTT の publish 数を返す。
const https = require('https'), fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const { WebSocketServer } = require(path.join(__dirname, 'deps/node_modules/ws'));
const dir = process.env.FAKE_DIR || '/tmp/zg-fake'; fs.mkdirSync(dir, { recursive: true });
if (!fs.existsSync(dir + '/k.pem')) execSync(`openssl req -x509 -newkey rsa:2048 -nodes -keyout ${dir}/k.pem -out ${dir}/c.pem -days 30 -subj /CN=fake 2>/dev/null`);
const tls = { key: fs.readFileSync(dir + '/k.pem'), cert: fs.readFileSync(dir + '/c.pem') };
const stats = { ntfyPost: 0, ntfySse: 0, ntfyPoll: 0, mqttPub: 0, mqttConn: 0 };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,OPTIONS' };

/* ---------- ntfy ---------- */
const store = {}, sse = {};
let seq = 0;
const rid = () => 'n' + (++seq).toString(36).padStart(8, '0');
const ntfy = https.createServer(tls, (req, res) => {
  const u = new URL(req.url, 'https://ntfy.sh');
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  if (u.pathname === '/__stats') { res.writeHead(200, { ...CORS, 'content-type': 'application/json' }); return res.end(JSON.stringify(stats)); }
  const parts = u.pathname.split('/').filter(Boolean), topic = parts[0] || '';
  if ((req.method === 'POST' || req.method === 'PUT') && parts.length === 1) {
    let b = ''; req.on('data', d => b += d); req.on('end', () => {
      stats.ntfyPost++;
      const ev = { id: rid(), time: Math.floor(Date.now() / 1000), event: 'message', topic, message: b };
      if (u.searchParams.get('cache') !== 'no') (store[topic] = store[topic] || []).push(ev);
      (sse[topic] || []).forEach(r => { try { r.write('data: ' + JSON.stringify(ev) + '\n\n'); } catch (e) {} });
      res.writeHead(200, { ...CORS, 'content-type': 'application/json' }); res.end(JSON.stringify(ev));
    }); return;
  }
  const since = parseInt(u.searchParams.get('since') || '0', 10) || 0;
  const old = (store[topic] || []).filter(e => e.time > since);
  if (parts[1] === 'sse') {
    stats.ntfySse++;
    res.writeHead(200, { ...CORS, 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    res.write('event: open\ndata: ' + JSON.stringify({ id: rid(), time: Math.floor(Date.now() / 1000), event: 'open', topic }) + '\n\n');
    old.forEach(ev => res.write('data: ' + JSON.stringify(ev) + '\n\n'));
    (sse[topic] = sse[topic] || []).push(res);
    const ka = setInterval(() => { try { res.write('event: keepalive\ndata: ' + JSON.stringify({ id: rid(), time: Math.floor(Date.now() / 1000), event: 'keepalive', topic }) + '\n\n'); } catch (e) {} }, 30000);
    req.on('close', () => { clearInterval(ka); sse[topic] = (sse[topic] || []).filter(x => x !== res); });
    return;
  }
  if (parts[1] === 'json') { stats.ntfyPoll++; res.writeHead(200, { ...CORS, 'content-type': 'application/x-ndjson' }); return res.end(old.map(e => JSON.stringify(e)).join('\n') + (old.length ? '\n' : '')); }
  res.writeHead(404, CORS); res.end('{}');
});
ntfy.listen(443, '127.0.0.2');

/* ---------- MQTT over WebSocket ---------- */
function mqtt(port) {
  const srv = https.createServer(tls, (q, r) => { r.writeHead(404); r.end(); });
  const wss = new WebSocketServer({ server: srv, handleProtocols: p => p.has('mqtt') ? 'mqtt' : false });
  const subs = new Set();
  wss.on('connection', ws => {
    stats.mqttConn++;
    ws.topics = new Set(); let rb = Buffer.alloc(0);
    const send = b => { try { ws.send(b); } catch (e) {} };
    const vlen = n => { const o = []; do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; o.push(d); } while (n > 0); return Buffer.from(o); };
    ws.on('message', d => {
      rb = Buffer.concat([rb, Buffer.from(d)]);
      while (rb.length >= 2) {
        let mul = 1, val = 0, i = 1, ok = false;
        while (i < rb.length && i < 5) { const c = rb[i]; val += (c & 127) * mul; mul *= 128; i++; if (!(c & 128)) { ok = true; break; } }
        if (!ok || rb.length < i + val) break;
        const type = rb[0], body = rb.slice(i, i + val); rb = rb.slice(i + val);
        const t = type >> 4;
        if (t === 1) send(Buffer.from([0x20, 2, 0, 0]));
        else if (t === 8) { // SUBSCRIBE
          const pid = body.slice(0, 2); let p = 2; const g = [];
          while (p < body.length) { const l = body.readUInt16BE(p); ws.topics.add(body.slice(p + 2, p + 2 + l).toString()); p += 2 + l + 1; g.push(0); }
          subs.add(ws); send(Buffer.concat([Buffer.from([0x90, 2 + g.length]), pid, Buffer.from(g)]));
        } else if (t === 10) { const pid = body.slice(0, 2); let p = 2; while (p < body.length) { const l = body.readUInt16BE(p); ws.topics.delete(body.slice(p + 2, p + 2 + l).toString()); p += 2 + l; } send(Buffer.concat([Buffer.from([0xB0, 2]), pid])); }
        else if (t === 3) { // PUBLISH
          const tl = body.readUInt16BE(0), q = (type >> 1) & 3, name = body.slice(2, 2 + tl).toString(), off = 2 + tl + (q ? 2 : 0);
          if (q === 1) send(Buffer.from([0x40, 2, body[2 + tl], body[3 + tl]]));
          stats.mqttPub++;
          const vb = Buffer.concat([Buffer.from([0, tl]), Buffer.from(name), body.slice(off)]);
          const pk = Buffer.concat([Buffer.from([0x30]), vlen(vb.length), vb]);
          for (const s of subs) if (s.readyState === 1 && s.topics.has(name)) { try { s.send(pk); } catch (e) {} }   // 本物と同じく、購読していれば送った本人にも届く
        } else if (t === 12) send(Buffer.from([0xD0, 0]));
        else if (t === 14) { try { ws.close(); } catch (e) {} }
      }
    });
    ws.on('close', () => subs.delete(ws));
  });
  srv.listen(port, '127.0.0.3');
}
mqtt(8884); mqtt(8084);
console.log('fake net ready');
