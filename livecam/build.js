// index.src.html の /*DATA*/ に data.json を入れて index.html を作る
const fs=require('fs');const d=__dirname;
fs.writeFileSync(d+'/index.html',fs.readFileSync(d+'/index.src.html','utf8').replace('/*DATA*/',fs.readFileSync(d+'/data.json','utf8').trim()));
