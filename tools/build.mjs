// Builds the public shop pages from each shop's live data, so search engines (Google, Facebook previews)
// see real items, prices and photos. Run by .github/workflows/build.yml; safe to run again any time.
// Usage: node tools/build.mjs            (writes into the repo folder)
//        FS_BASE=http://localhost:8787/... OUT=/tmp/out node tools/build.mjs   (testing)
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm'; import crypto from 'node:crypto';
const DIR=path.dirname(path.dirname(new URL(import.meta.url).pathname));
const OUT=process.env.OUT||DIR;
const CFG=JSON.parse(fs.readFileSync(path.join(DIR,'shops.json'),'utf8'));
const SRC=f=>fs.readFileSync(path.join(DIR,'src',f),'utf8');
vm.runInThisContext(SRC('core.js'));
const A=globalThis.AO, esc=A.esc;
const FS=process.env.FS_BASE||A.FB.base, KEY=A.FB.key;
const SITE=CFG.site.replace(/\/?$/,'/');

const css=SRC('shop.css'), js=SRC('core.js')+'\n'+SRC('app.js');
const V=crypto.createHash('sha1').update(css+js).digest('hex').slice(0,8);
const write=(f,data)=>{ const p=path.join(OUT,f); fs.mkdirSync(path.dirname(p),{recursive:true});
  if(fs.existsSync(p)&&Buffer.compare(fs.readFileSync(p),Buffer.from(data))===0) return; fs.writeFileSync(p,data); };
const fill=(t,o)=>t.replace(/\{\{(\w+)\}\}/g,(m,k)=>k in o?o[k]:'');
const LS=new RegExp('['+String.fromCharCode(8232,8233)+']','g'), BS=String.fromCharCode(92);  // keep </script> and line separators out of inline JSON
const jsonScript=o=>JSON.stringify(o).replace(/</g,BS+'u003c').replace(LS,c=>BS+'u'+c.charCodeAt(0).toString(16));
const ldScript=o=>`<script type="application/ld+json">${jsonScript(o)}</script>`;
const plain=s=>String(s||'').replace(/\s+/g,' ').trim();
const cut=(s,n)=>{ s=plain(s); return s.length>n?s.slice(0,n-1).replace(/\s+\S*$/,'')+'…':s; };

async function get(url){ const r=await fetch(url); if(r.status===404) return null; if(!r.ok) throw new Error(url.split('?')[0]+' → '+r.status); return r.json(); }
async function loadShop(id){
  const d=await get(`${FS}/shops/${id}?key=${KEY}`); if(!d) return null;
  const s=A.obj(d.fields||{}); let page='', items=[];
  if(s.active===true) do{
    const r=await get(`${FS}/shops/${id}/items?pageSize=60&key=${KEY}${page?'&pageToken='+page:''}`);
    (r&&r.documents||[]).forEach(doc=>items.push({id:doc.name.split('/').pop(),...A.obj(doc.fields||{})})); page=r&&r.nextPageToken||'';
  }while(page);
  return {s,items:items.filter(i=>i.name&&/^[\w-]{1,40}$/.test(i.id))};
}
const IMG=/^data:image\/(jpeg|webp|png);base64,([A-Za-z0-9+/=]+)$/;
const extOf=t=>t==='jpeg'?'jpg':t;

function head({title,desc,url,image,type,ld,robots}){
  return [`<title>${esc(title)}</title>`,`<meta name="description" content="${esc(desc)}">`,
    robots?`<meta name="robots" content="${robots}">`:'', url?`<link rel="canonical" href="${esc(url)}">`:'',
    `<meta property="og:type" content="${type||'website'}">`,`<meta property="og:title" content="${esc(title)}">`,`<meta property="og:description" content="${esc(desc)}">`,
    url?`<meta property="og:url" content="${esc(url)}">`:'', image?`<meta property="og:image" content="${esc(image)}">`:'', `<meta property="og:locale" content="en_PH">`,
    `<meta name="twitter:card" content="${image?'summary_large_image':'summary'}">`,
    CFG.google?`<meta name="google-site-verification" content="${esc(CFG.google)}">`:'',
    ld?ldScript(ld):''].filter(Boolean).join('\n');
}

async function buildShop(conf,sitemap){
  const id=conf.id, dir=id+'/', url=SITE+dir;
  const got=await loadShop(id);
  if(!got||got.s.active!==true||(got.s.until&&got.s.until<new Date().toISOString().slice(0,10))){
    // not open: a plain page that checks live (no items kept for search engines)
    write(dir+'index.html',fill(SRC('page.html'),{ROOT:'../',SHOP:id,PAGE:'shop',V,HEAD:head({title:(got&&got.s.name)||'Shop page',desc:'Aquarium shop page.',robots:'noindex'}),
      HERO:A.hero(got?got.s:{name:'Shop page'},[],'',true),MAIN:'<div class="grid skel" aria-hidden="true"></div>',INFOHIDE:'hidden',PRE:jsonScript({base:''})}));
    fs.rmSync(path.join(OUT,dir,'p'),{recursive:true,force:true}); fs.rmSync(path.join(OUT,dir,'img'),{recursive:true,force:true});
    return;
  }
  const {s,items}=got, now=Date.now();
  // pictures → files
  const imgDir=path.join(OUT,dir,'img'); fs.mkdirSync(imgDir,{recursive:true});
  const keep=new Set(), img={};
  let logo='';
  { const m=IMG.exec(s.logo||'')||/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(s.logo||''); if(m){ logo='img/logo.'+extOf(m[1]); keep.add('logo.'+extOf(m[1])); write(dir+logo,Buffer.from(m[2],'base64')); } }
  for(const i of items){
    const m=IMG.exec(i.img||''); const u=i.updated||0;
    if(m){ const f=i.id+'.'+extOf(m[1]); keep.add(f); write(dir+'img/'+f,Buffer.from(m[2],'base64')); img[i.id]={u,f:'img/'+f+'?v='+u.toString(36)}; }
    else img[i.id]={u,f:''};
    delete i.img;
  }
  for(const f of fs.readdirSync(imgDir)) if(!keep.has(f)) fs.rmSync(path.join(imgDir,f));
  const pages=Object.fromEntries(items.map(i=>[i.id,1]));
  const pub={...s}; delete pub.owner; delete pub.logo;
  const sorted=A.sort(items,now), on=items.filter(i=>i.stock>0).length, pre=items.filter(A.isPre).length;
  const city=conf.city||'';
  const title=`${s.name} – ${conf.title||'Aquarium fish & supplies'+(city?' in '+city:'')}`;
  const desc=cut(`${s.tagline?s.tagline+'. ':''}${on} item${on===1?'':'s'} on hand${pre?`, ${pre} on pre-order`:''}${city?' in '+city:''}. See photos and prices, then order on Messenger.`,158);
  const abs=f=>f?url+f.replace(/\?.*$/,''):'';
  const firstImg=sorted.find(i=>img[i.id].f);
  const store={'@type':conf.type||'PetStore','@id':url+'#store',name:s.name,url,description:plain(s.about||s.tagline||desc),
    image:logo?abs(logo):undefined,logo:logo?abs(logo):undefined,telephone:A.phone(s)||undefined,
    address:s.address?{'@type':'PostalAddress',streetAddress:plain(s.address),addressLocality:city||undefined,addressCountry:'PH'}:undefined,
    hasMap:A.safeUrl(s.map)||undefined,sameAs:A.fbPage(s)?[A.fbPage(s)]:undefined,currenciesAccepted:'PHP',paymentAccepted:s.payment?plain(s.payment):undefined};
  const ld={'@context':'https://schema.org','@graph':[store,{'@type':'WebSite','@id':url+'#site',url,name:s.name,inLanguage:'en-PH'},
    {'@type':'ItemList','name':s.name+' items','numberOfItems':sorted.length,'itemListElement':sorted.slice(0,200).map((i,k)=>({'@type':'ListItem',position:k+1,url:url+'p/'+i.id+'/',name:A.label(i)}))}]};
  const ctx={shop:s,now,img:i=>img[i.id].f||'',href:i=>'p/'+i.id+'/',inOrder:()=>0};
  const info=A.info(s);
  const preData={base:'',shop:pub,items,img,pages};
  write(dir+'index.html',fill(SRC('page.html'),{ROOT:'../',SHOP:id,PAGE:'shop',V,
    HEAD:head({title,desc,url,image:firstImg?abs(img[firstImg.id].f):abs(logo),ld}),
    STYLE:/^#[0-9a-f]{6}$/i.test(s.color||'')?`<style>:root{--accent:${s.color}}</style>`:'',
    HERO:A.hero(s,items,logo,true),CHIPS:A.chips(items,'all',''),LISTTITLE:esc(`Items at ${s.name}`),
    MAIN:sorted.length?'<div class="grid">'+sorted.map(i=>A.card(i,ctx)).join('')+'</div>':'<p class="empty">No items posted yet. Message the shop to ask what is available.</p>',
    INFO:info,INFOHIDE:info?'':'hidden',PRE:jsonScript(preData)}));
  sitemap.push({loc:url,last:Math.max(s.updated||0,...items.map(i=>i.updated||0))});

  // one page per item
  const pdir=path.join(OUT,dir,'p'); fs.mkdirSync(pdir,{recursive:true});
  for(const d of fs.readdirSync(pdir)) if(!pages[d]) fs.rmSync(path.join(pdir,d),{recursive:true,force:true});
  const heroSlim=`<div class="brand">${logo?`<a href="../../"><img class="logo" src="../../${esc(logo)}" alt="${esc(s.name)} logo" width="46" height="46"></a>`:''}<div class="brand-t"><p class="shopname"><a href="../../">${esc(s.name)}</a></p></div></div>`;
  for(const i of items){
    const iu=url+'p/'+i.id+'/', f=img[i.id].f, label=A.label(i);
    const t=`${label} – ${A.peso(A.priceOf(i))} | ${s.name}`;
    const state=i.stock>0?`${i.stock} on hand`:i.pre?`pre-order${i.eta?', arrives '+A.fmtEta(i.eta):''}`:'sold out';
    const d=cut(`${label} at ${s.name}${city?', '+city:''}: ${A.peso(A.priceOf(i))}, ${state}. ${i.care?plain(i.care)+' ':''}Order on Messenger.`,158);
    const prod={'@type':'Product','@id':iu+'#product',name:label,sku:i.id,category:i.cat||undefined,image:f?[abs(f)]:undefined,description:plain(i.care)||d,
      brand:undefined,offers:{'@type':'Offer',url:iu,priceCurrency:'PHP',price:String(A.priceOf(i)),availability:A.avail(i),itemCondition:'https://schema.org/NewCondition',seller:{'@id':url+'#store'}}};
    const crumbsLd={'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:s.name,item:url},{'@type':'ListItem',position:2,name:label,item:iu}]};
    const live=`<div class="price${A.onSale(i)?' sale':''}">${A.peso(A.priceOf(i))}${A.onSale(i)?`<s>${A.peso(i.price)}</s>`:''}</div>${A.stockLine(i)}
<div class="row">${A.isOut(i)?`<a class="go" target="_blank" rel="noopener" href="${esc(A.msgLink(s,'Hi! Kailan po babalik ang '+label+'?'))}">Ask when it's back</a>`
  :`<a class="go" target="_blank" rel="noopener" href="${esc(A.msgLink(s,'Hi! Available pa po ba ang '+label+' ('+A.peso(A.priceOf(i))+')?'))}">Order on Messenger</a><button class="add" type="button" data-add="${esc(i.id)}" style="margin:0">Add to order list</button>`}</div>`;
    write(dir+'p/'+i.id+'/index.html',fill(SRC('item.html'),{ROOT:'../../../',SHOP:id,ITEM:i.id,V,
      HEAD:head({title:t,desc:d,url:iu,image:f?abs(f):abs(logo),type:'product',ld:{'@context':'https://schema.org','@graph':[prod,crumbsLd]}}),
      STYLE:/^#[0-9a-f]{6}$/i.test(s.color||'')?`<style>:root{--accent:${s.color}}</style>`:'',
      HERO:heroSlim,CRUMBS:`<a href="../../">${esc(s.name)}</a> / ${esc(i.cat||'Items')}`,
      PHOTO:f?`<img src="../../${esc(f)}" alt="${esc(A.alt(i))}" width="480" height="480" fetchpriority="high">`:`<span class="ph">${A.FISH}</span>`,
      BADGES:A.badges(i,now),NAME:esc(i.name),META:esc([i.size,i.cat].filter(Boolean).join(' · ')),LIVE:live,
      CARE:i.care?`<div class="care"><h2 style="margin:0 0 4px;font:600 15px var(--disp)">Care and info</h2>${esc(i.care)}</div>`:'',
      SHOPURL:'../../',SHOPNAME:esc(s.name),INFO:info,INFOHIDE:info?'':'hidden',
      PRE:jsonScript({base:'../../',shop:pub,items:[i],img:{[i.id]:img[i.id]},pages})}));
    sitemap.push({loc:iu,last:i.updated||0,img:f?abs(f):''});
  }
}

const sitemap=[];
for(const conf of CFG.shops){ try{ await buildShop(conf,sitemap); console.log('built',conf.id); }catch(e){ console.error('skip',conf.id,e.message); process.exitCode=1; } }
// the page for any shop (?s=id) and the list of shops
write('index.html',fill(SRC('page.html'),{ROOT:'',SHOP:'',PAGE:'root',V,HEAD:head({title:'Aquatic Ops shop pages',desc:'Aquarium shops: see what is on hand and order on Messenger.',url:SITE}),
  HERO:'<div class="brand"><div class="brand-t"><h1 class="shopname" id="sname">Aquarium shops</h1></div></div>',MAIN:'<div class="grid skel" aria-hidden="true"><div class="item"><div class="photo"></div></div><div class="item"><div class="photo"></div></div><div class="item"><div class="photo"></div></div><div class="item"><div class="photo"></div></div></div>',
  INFOHIDE:'hidden',PRE:jsonScript({base:'',shops:CFG.shops.map(s=>({id:s.id,name:s.name||s.id}))})}));
write('shop.css',css); write('shop.js',js); write('icon.svg',SRC('icon.svg'));
write('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`+
  sitemap.map(u=>`<url><loc>${esc(u.loc)}</loc>${u.last?`<lastmod>${new Date(u.last).toISOString().slice(0,10)}</lastmod>`:''}${u.img?`<image:image><image:loc>${esc(u.img)}</image:loc></image:image>`:''}</url>`).join('\n')+'\n</urlset>\n');
