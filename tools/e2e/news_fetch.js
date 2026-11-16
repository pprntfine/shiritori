const {chromium}=require('playwright');const DIR=process.argv[2];
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844}});
 let t0=0,reqs=[];
 await ctx.route('**/*',async r=>{const u=r.request().url(); if(u.startsWith('https://zg.test/'))return r.fulfill({path:DIR+'/'+(u.split('/').pop().split('?')[0]||'index.html')});
   if(u.includes('/news')){ reqs.push([Date.now()-t0,u.split('/').pop()]); return r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,at:Date.now(),tokushima:[{t:'テスト見出し',u:'https://example.com/a'}],jiken:[],keizai:[],market:{}})}); } return r.abort();});
 const pg=await ctx.newPage(); pg.on('domcontentloaded',()=>{}); t0=Date.now(); await pg.goto('https://zg.test/index.html'); await pg.waitForTimeout(3000);
 console.log('requests(ms after nav):',JSON.stringify(reqs),'refresh btn:',await pg.$('#zn-re')?'あり':'なし','head:',await pg.evaluate(()=>document.querySelector('#zg-news .zn-head').innerText));
 await b.close();})();
