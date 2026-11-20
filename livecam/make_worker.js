// livecam の公開用 Worker（ファイルを埋め込んで返すだけ）を作る: node livecam/make_worker.js 出力先フォルダ
const fs=require('fs'),path=require('path');const d=__dirname,out=process.argv[2];
require('./build.js');
const files={'/':['index.html','text/html; charset=utf-8'],'/index.html':['index.html','text/html; charset=utf-8'],'/manifest.webmanifest':['manifest.webmanifest','application/manifest+json'],'/icon-192.png':['icon-192.png','image/png'],'/icon-512.png':['icon-512.png','image/png'],'/sw.js':['sw.js','text/javascript; charset=utf-8']};
const data={};for(const k in files){const [f,t]=files[k];data[k]={t,b:fs.readFileSync(path.join(d,f)).toString('base64')}}
const src='const F='+JSON.stringify(data)+';\nconst B={};function bytes(k){if(!B[k]){const s=atob(F[k].b);const u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);B[k]=u}return B[k]}\nexport default{fetch(req){const p=new URL(req.url).pathname;const f=F[p];if(!f)return new Response("Not found",{status:404});return new Response(bytes(p),{headers:{"content-type":f.t,"cache-control":f.t.startsWith("text/html")?"no-cache":"public, max-age=3600","x-content-type-options":"nosniff"}})}};\n';
fs.writeFileSync(path.join(out,'worker.js'),src);fs.writeFileSync(path.join(out,'meta.json'),JSON.stringify({main_module:'worker.js',compatibility_date:'2026-11-01'}));
