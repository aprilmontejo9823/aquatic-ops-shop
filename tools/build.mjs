// Builds the public shop pages from each shop's live data, so search engines (Google, Facebook previews)
// see real items, photos and shop details. Run by .github/workflows/build.yml; safe to run again any time.
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

const css=SRC('shop.css'), js=SRC('core.js')+'\n'+SRC('app.js'), LAYOUT=SRC('layout.html');
const V=crypto.createHash('sha1').update(css+js).digest('hex').slice(0,8);
const write=(f,data)=>{ const p=path.join(OUT,f); fs.mkdirSync(path.dirname(p),{recursive:true});
  if(fs.existsSync(p)&&Buffer.compare(fs.readFileSync(p),Buffer.from(data))===0) return; fs.writeFileSync(p,data); };
const fill=o=>LAYOUT.replace(/\{\{(\w+)\}\}/g,(m,k)=>k in o?o[k]:'');
const LS=new RegExp('['+String.fromCharCode(8232,8233)+']','g'), BS=String.fromCharCode(92);  // keep </script> and line separators out of inline JSON
const jsonScript=o=>JSON.stringify(o).replace(/</g,BS+'u003c').replace(LS,c=>BS+'u'+c.charCodeAt(0).toString(16));
const ldScript=o=>`<script type="application/ld+json">${jsonScript(o)}</script>`;
const plain=s=>String(s||'').replace(/\s+/g,' ').trim();
const cut=(s,n)=>{ s=plain(s); return s.length>n?s.slice(0,n-1).replace(/\s+\S*$/,'')+'…':s; };
const color=s=>/^#[0-9a-f]{6}$/i.test(s.color||'')?`<style>:root{--accent:${s.color}}</style>`:'';

async function get(url){ const r=await fetch(url); if(r.status===404) return null; if(!r.ok) throw new Error(url.split('?')[0]+' → '+r.status); return r.json(); }
async function list(id,col){ let page='', out=[];
  do{ const r=await get(`${FS}/shops/${id}/${col}?pageSize=50&key=${KEY}${page?'&pageToken='+page:''}`);
    (r&&r.documents||[]).forEach(doc=>out.push({id:doc.name.split('/').pop(),...A.obj(doc.fields||{})})); page=r&&r.nextPageToken||''; }while(page);
  return out.filter(x=>/^[\w-]{1,40}$/.test(x.id)); }
async function loadShop(id){
  const d=await get(`${FS}/shops/${id}?key=${KEY}`); if(!d) return null;
  const s=A.obj(d.fields||{});
  if(s.active!==true) return {s,items:[],gal:[]};
  return {s,items:(await list(id,'items')).filter(i=>i.name),gal:(await list(id,'gallery')).sort((a,b)=>(a.ord||0)-(b.ord||0))};
}
/* a short Google Maps link (maps.app.goo.gl) → the full link, which has the place and coordinates */
async function resolveMap(u){ if(!/^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//.test(u||'')) return u||'';
  try{ const ac=new AbortController(), t=setTimeout(()=>ac.abort(),8000); const r=await fetch(u,{redirect:'follow',signal:ac.signal}); clearTimeout(t); return r.url||u; }catch(e){ return u; } }
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
  const rm=p=>fs.rmSync(path.join(OUT,dir,p),{recursive:true,force:true});
  if(!got||got.s.active!==true||(got.s.until&&got.s.until<new Date().toISOString().slice(0,10))){
    // not open: a plain page that checks live (nothing kept for search engines)
    const s=got?got.s:{name:'Shop page'};
    write(dir+'index.html',fill({ROOT:'../',SHOP:id,PAGE:'home',V,HEAD:head({title:s.name||'Shop page',desc:'Aquarium shop page.',robots:'noindex'}),
      HEADER:A.hero(s,[],{h1:true,ctx:{catHref:()=>'#'}}),BODY:'<div class="wrap state"><p>Loading…</p></div>',PRE:jsonScript({folder:1,base:''})}));
    rm('p'); rm('img'); rm('c'); return;
  }
  const {s,items,gal}=got, now=Date.now(), city=conf.city||'';
  // pictures → files
  fs.mkdirSync(path.join(OUT,dir,'img'),{recursive:true});
  const keep=new Set(), img={}, put=(name,b64)=>{ keep.add(name); write(dir+'img/'+name,Buffer.from(b64,'base64')); return 'img/'+name; };
  let logo=''; { const m=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(s.logo||''); if(m) logo=put('logo.'+extOf(m[1]),m[2]); }
  const photos=gal.map(g=>{ const m=IMG.exec(g.img||''); return m?{src:put('g-'+g.id+'.'+extOf(m[1]),m[2])+'?v='+(g.updated||0).toString(36),cap:g.cap||''}:null; }).filter(Boolean);
  for(const i of items){
    const m=IMG.exec(i.img||''), u=i.updated||0;
    img[i.id]=m?{u,f:put(i.id+'.'+extOf(m[1]),m[2])+'?v='+u.toString(36)}:{u,f:''};
    delete i.img;
  }
  for(const f of fs.readdirSync(path.join(OUT,dir,'img'))) if(!keep.has(f)) fs.rmSync(path.join(OUT,dir,'img',f));
  const pages=Object.fromEntries(items.map(i=>[i.id,1]));
  const pub={...s}; delete pub.owner; delete pub.logo;
  const mapLink=await resolveMap(s.map), mapq=s.address||s.map?A.mapQuery(s,mapLink):'';
  const geo=/^(-?\d+\.\d+),(-?\d+\.\d+)$/.exec(mapq);
  const cats=A.cats(items), ask=A.askMode(s,items), abs=f=>f?url+f.replace(/\?.*$/,''):'';
  const at=base=>({shop:s,now,img:i=>img[i.id].f?base+img[i.id].f:'',href:i=>base+'p/'+i.id+'/',abs:i=>url+'p/'+i.id+'/',inOrder:()=>0,catHref:sl=>base+'c/'+sl+'/',home:base||'./'});
  const pre=(base,extra)=>jsonScript({folder:1,base,site:url,shop:pub,items,img,pages,mapq,...extra});
  const logoAt=base=>logo?base+logo:'';
  const firstImg=A.sort(items.filter(A.avail),now).find(i=>img[i.id].f);
  const store={'@type':conf.type||'PetStore','@id':url+'#store',name:s.name,url,description:plain(s.about||s.tagline||''),slogan:s.motto||undefined,foundingDate:s.started||undefined,
    image:[...photos.map(p=>abs(p.src)),logo?abs(logo):''].filter(Boolean),logo:logo?abs(logo):undefined,telephone:A.phone(s)||undefined,
    address:s.address?{'@type':'PostalAddress',streetAddress:plain(s.address),addressLocality:city||undefined,addressCountry:'PH'}:undefined,
    geo:geo?{'@type':'GeoCoordinates',latitude:+geo[1],longitude:+geo[2]}:undefined,
    hasMap:A.safeUrl(mapLink)||A.safeUrl(s.map)||undefined,sameAs:A.fbPage(s)?[A.fbPage(s)]:undefined,currenciesAccepted:'PHP',paymentAccepted:s.payment?plain(s.payment):undefined};
  const footAt=base=>A.foot(s,cats,at(base));

  // front page
  { const c=at(''), avail=items.filter(A.avail).length;
    const title=`${s.name} – ${conf.title||'Aquarium fish & supplies'+(city?' in '+city:'')}`;
    const desc=cut(`${s.motto?s.motto+'. ':s.tagline?s.tagline+'. ':''}${avail} item${avail===1?'':'s'} available${city?' in '+city:''}: ${cats.map(x=>x.name.toLowerCase()).join(', ')}. See photos, then message us on Messenger.`,158);
    write(dir+'index.html',fill({ROOT:'../',SHOP:id,PAGE:'home',V,STYLE:color(s),
      HEAD:head({title,desc,url,image:photos[0]?abs(photos[0].src):firstImg?abs(img[firstImg.id].f):abs(logo),
        ld:{'@context':'https://schema.org','@graph':[store,{'@type':'WebSite','@id':url+'#site',url,name:s.name,inLanguage:'en-PH'}]}}),
      HEADER:A.hero(s,items,{logo:logoAt(''),photo:photos[0]&&photos[0].src,h1:true,cats,ctx:c,mapq}),NAV:A.nav(cats,'home',c),
      BODY:A.home(s,items,photos,c,mapq),FOOT:footAt(''),FAB:A.fab(s),PRE:pre('',{})}));
    sitemap.push({loc:url,last:Math.max(s.updated||0,...items.map(i=>i.updated||0)),img:photos[0]?abs(photos[0].src):''});
  }
  // one page per category
  const keepC=new Set();
  for(const cat of cats){
    keepC.add(cat.slug); const base='../../', c=at(base), cu=url+'c/'+cat.slug+'/', L=items.filter(i=>(i.cat||'Items')===cat.name);
    const title=`${cat.name} available at ${s.name}${city?' – '+city:''}`;
    const desc=cut(`${cat.avail} ${cat.name.toLowerCase()} available at ${s.name}${city?', '+city:''}. ${[...new Set(L.filter(A.avail).map(i=>i.sub||i.name))].slice(0,8).join(', ')}. ${ask?'Ask the price on Messenger.':'See prices and photos.'}`,158);
    const ld={'@context':'https://schema.org','@graph':[{'@type':'CollectionPage','@id':cu,url:cu,name:title,isPartOf:{'@id':url+'#site'}},
      {'@type':'ItemList',numberOfItems:L.length,itemListElement:A.sort(L,now).slice(0,200).map((i,k)=>({'@type':'ListItem',position:k+1,url:url+'p/'+i.id+'/',name:A.label(i)}))},
      {'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:s.name,item:url},{'@type':'ListItem',position:2,name:cat.name,item:cu}]}]};
    const ci=A.sort(L.filter(A.avail),now).find(i=>img[i.id].f);
    write(dir+'c/'+cat.slug+'/index.html',fill({ROOT:'../../../',SHOP:id,PAGE:'cat',CAT:cat.slug,V,STYLE:color(s),
      HEAD:head({title,desc,url:cu,image:ci?abs(img[ci.id].f):abs(logo),ld}),
      HEADER:A.hero(s,items,{logo:logoAt(base),slim:true,home:base}),NAV:A.nav(cats,cat.slug,c),BODY:A.catPage(cat,L,c),FOOT:footAt(base),FAB:A.fab(s),PRE:pre(base,{})}));
    sitemap.push({loc:cu,last:Math.max(0,...L.map(i=>i.updated||0))});
  }
  if(fs.existsSync(path.join(OUT,dir,'c'))) for(const d of fs.readdirSync(path.join(OUT,dir,'c'))) if(!keepC.has(d)) rm('c/'+d);

  // one page per item
  fs.mkdirSync(path.join(OUT,dir,'p'),{recursive:true});
  for(const d of fs.readdirSync(path.join(OUT,dir,'p'))) if(!pages[d]) rm('p/'+d);
  for(const i of items){
    const base='../../', c=at(base), iu=url+'p/'+i.id+'/', f=img[i.id].f, label=A.label(i), cat=cats.find(x=>x.name===(i.cat||'Items'));
    const priced=A.hasPrice(i);
    const t=`${label}${priced?' – '+A.peso(A.priceOf(i)):''} | ${s.name}`;
    const st=i.stock>0?`${i.stock} on hand`:i.pre?`pre-order${i.eta?', arrives '+A.fmtEta(i.eta):''}`:'sold out';
    const d=cut(`${label} at ${s.name}${city?', '+city:''}: ${priced?A.peso(A.priceOf(i))+', ':''}${st}. ${i.care?plain(i.care)+' ':''}${priced?'Order':'Ask the price'} on Messenger.`,158);
    const prod={'@type':'Product','@id':iu+'#product',name:label,sku:i.id,category:[i.cat,i.sub].filter(Boolean).join(' > ')||undefined,image:f?[abs(f)]:undefined,description:plain(i.care)||d,
      offers:priced?{'@type':'Offer',url:iu,priceCurrency:'PHP',price:String(A.priceOf(i)),availability:A.schemaAvail(i),itemCondition:'https://schema.org/NewCondition',seller:{'@id':url+'#store'}}:undefined};
    const crumbs={'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:s.name,item:url},cat&&{'@type':'ListItem',position:2,name:cat.name,item:url+'c/'+cat.slug+'/'},{'@type':'ListItem',position:cat?3:2,name:label,item:iu}].filter(Boolean)};
    const live=`${priced?`<div class="price${A.onSale(i)?' sale':''}">${A.peso(A.priceOf(i))}${A.onSale(i)?`<s>${A.peso(i.price)}</s>`:''}</div>`:''}${A.stockLine(i)}
<div class="row">${priced&&A.avail(i)?`<a class="go" target="_blank" rel="noopener" href="${esc(A.msgLink(s,'Hi '+s.name+'! Available pa po ba ang '+label+' ('+A.peso(A.priceOf(i))+')?\n'+iu))}">${A.MSGR}<span>Order on Messenger</span></a><button class="add" type="button" data-add="${esc(i.id)}" style="margin:0">Add to order list</button>`:A.action(i,c,'go')}<button type="button" data-share="${esc(i.id)}">Share</button></div>`;
    const body=`<main class="wrap" id="items"><nav class="crumbs" aria-label="Breadcrumb"><a href="${base}">Home</a>${cat?` / <a href="${base}c/${cat.slug}/">${esc(cat.name)}</a>`:''}${i.sub?` / ${esc(i.sub)}`:''}</nav>
<article class="pitem"><div class="photo">${f?`<img src="${base}${esc(f)}" alt="${esc(A.alt(i))}" width="480" height="480" fetchpriority="high">`:`<span class="ph">${A.FISH}</span>`}<span class="badges">${A.badges(i,now)}</span></div>
<div><h1>${esc(i.name)}</h1><p class="meta">${esc(A.meta(i))}</p><div id="ipLive">${live}</div>
${i.care?`<div class="care"><h2>Care and info</h2>${esc(i.care)}</div>`:''}
${cat?`<p class="note"><a href="${base}c/${cat.slug}/">See all ${esc(cat.name.toLowerCase())} available</a></p>`:''}</div></article></main>`;
    write(dir+'p/'+i.id+'/index.html',fill({ROOT:'../../../',SHOP:id,PAGE:'item',ITEM:i.id,CAT:cat?cat.slug:'',V,STYLE:color(s),
      HEAD:head({title:t,desc:d,url:iu,image:f?abs(f):abs(logo),type:'product',ld:{'@context':'https://schema.org','@graph':[prod,crumbs]}}),
      HEADER:A.hero(s,items,{logo:logoAt(base),slim:true,home:base}),NAV:A.nav(cats,cat?cat.slug:'',c),BODY:body,FOOT:footAt(base),FAB:A.fab(s),
      PRE:jsonScript({folder:1,base,site:url,shop:pub,items:[i],img:{[i.id]:img[i.id]},pages})}));
    sitemap.push({loc:iu,last:i.updated||0,img:f?abs(f):''});
  }
}

const sitemap=[];
for(const conf of CFG.shops){ try{ await buildShop(conf,sitemap); console.log('built',conf.id); }catch(e){ console.error('skip',conf.id,e.message); process.exitCode=1; } }
// the page for any shop (?s=id) and the list of shops
write('index.html',fill({ROOT:'',SHOP:'',PAGE:'root',V,HEAD:head({title:'Aquatic Ops shop pages',desc:'Aquarium shops: see what is available and message the shop on Messenger.',url:SITE}),
  HEADER:'<header class="hero slim"><div class="wrap hero-in"><span class="brand"><span class="shopname">Aquarium shops</span></span></div></header>',BODY:'<div class="wrap state"><p>Loading…</p></div>',
  PRE:jsonScript({base:'',shops:CFG.shops.map(s=>({id:s.id,name:s.name||s.id}))})}));
write('shop.css',css); write('shop.js',js); write('icon.svg',SRC('icon.svg'));
write('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`+
  sitemap.map(u=>`<url><loc>${esc(u.loc)}</loc>${u.last?`<lastmod>${new Date(u.last).toISOString().slice(0,10)}</lastmod>`:''}${u.img?`<image:image><image:loc>${esc(u.img)}</image:loc></image:image>`:''}</url>`).join('\n')+'\n</urlset>\n');
