/* Aquatic Ops shop page — shared rendering (used by the browser and by tools/build.mjs). No DOM here. */
(function(G){
'use strict';
const AO=G.AO={};
AO.FB={key:'AIzaSyBhh9xX0ddpa7-GMfFlcFBg6pF_pR3NWOw',base:'https://firestore.googleapis.com/v1/projects/aquatic-ops/databases/(default)/documents'};
const esc=AO.esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
AO.peso=n=>'₱'+Number(n||0).toLocaleString('en-PH',{maximumFractionDigits:2});
const val=AO.val=v=>{ if(!v) return null; if('stringValue' in v) return v.stringValue; if('integerValue' in v) return +v.integerValue; if('doubleValue' in v) return v.doubleValue;
  if('booleanValue' in v) return v.booleanValue; if('nullValue' in v) return null; if('timestampValue' in v) return Date.parse(v.timestampValue);
  if('mapValue' in v) return AO.obj(v.mapValue.fields||{}); if('arrayValue' in v) return (v.arrayValue.values||[]).map(val); return null; };
AO.obj=f=>Object.fromEntries(Object.entries(f||{}).map(([k,v])=>[k,val(v)]));
const DAY=864e5, NEWDAYS=14;
AO.isNew=(i,now)=>!!i.since&&(now||Date.now())-i.since<NEWDAYS*DAY;
AO.hasPrice=i=>i.price!=null&&i.price>0;
AO.onSale=i=>AO.hasPrice(i)&&i.sale!=null&&i.sale>0&&i.sale<i.price;
AO.isPre=i=>!!i.pre&&!(i.stock>0);
AO.isOut=i=>!(i.stock>0)&&!i.pre;
AO.avail=i=>!AO.isOut(i);
AO.priceOf=i=>AO.onSale(i)?i.sale:i.price;
AO.label=i=>i.name+(i.size?' ('+i.size+')':'');
AO.fmtEta=e=>{ if(/^\d{4}-\d{2}-\d{2}$/.test(e||'')){ const d=new Date(e+'T00:00:00'); return d.toLocaleDateString('en-PH',{month:'short',day:'numeric'}); } return e||''; };
AO.slug=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'items';
/* prices are shown only when the shop shows them (the app leaves them out otherwise) */
AO.askMode=(s,items)=>s.prices===false||!items.some(AO.hasPrice);

/* Messenger: the shop's Facebook page. Falls back to a facebook link typed in the phone field. */
const FBRE=/(?:m\.me|facebook\.com|fb\.com|messenger\.com\/t)\/([^/?#\s]+)/i;
AO.msgUser=s=>{ const m=String(s.messenger||'').trim(); const x=FBRE.exec(m)||FBRE.exec(String(s.phone||'')); if(x) return x[1].replace(/^@/,''); return /^@?[\w.]{3,60}$/.test(m)?m.replace(/^@/,''):''; };
AO.msgLink=(s,text)=>{ const u=AO.msgUser(s); return u?`https://m.me/${encodeURIComponent(u)}${text?'?text='+encodeURIComponent(text):''}`:''; };
AO.fbPage=s=>{ const u=AO.msgUser(s); return u?'https://www.facebook.com/'+encodeURIComponent(u):''; };
AO.phone=s=>{ const p=String(s.phone||'').trim(); return /^[+\d][\d\s().-]{6,}$/.test(p)?p:''; };
AO.safeUrl=u=>{ try{ const x=new URL(u); return x.protocol==='https:'?x.href:''; }catch(e){ return ''; } };
AO.askText=(s,i,url)=>`Hi ${s.name}! Magkano po ang ${AO.label(i)}? Available pa po ba?${url?'\n'+url:''}`;
AO.backText=(s,i)=>`Hi ${s.name}! Kailan po babalik ang ${AO.label(i)}?`;

/* Google Map: coordinates or a place from the shop's map link, otherwise its name and address */
AO.mapQuery=(s,resolved)=>{ const u=String(resolved||s.map||'');
  let m=/@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(u)||/[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/.exec(u); if(m) return m[1]+','+m[2];
  m=/\/place\/([^/@?]+)/.exec(u); if(m) return decodeURIComponent(m[1].replace(/\+/g,' '));
  const a=String(s.address||'').replace(/\s+/g,' ').trim(); return [s.name,a].filter(Boolean).join(', '); };
AO.mapEmbed=q=>'https://maps.google.com/maps?q='+encodeURIComponent(q)+'&z=16&output=embed';
AO.directions=(s,q)=>AO.safeUrl(s.map)||'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(q);

const I={
  fish:'<path d="M8 32c8-12 22-16 34-10l12-8v36l-12-8C30 48 16 44 8 32z"/><circle cx="20" cy="29" r="2.4" fill="currentColor"/>',
  hours:'<path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/>',
  where:'<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  delivery:'<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  payment:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
  call:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  route:'<path d="M3 11 21 3l-8 18-2-8z"/>',
  vision:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  mission:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
  service:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  gear:'<rect x="4" y="9" width="16" height="10" rx="2"/><path d="M8 9V6h8v3M4 13h16"/>',
  plant:'<path d="M12 21V10M12 10C12 6 9 3 5 3c0 4 3 7 7 7zM12 13c0-4 3-7 7-7 0 4-3 7-7 7z"/>',
  food:'<path d="M6 3h12l-1 4H7zM7 7l1 14h8l1-14"/>'};
const icon=(k,vb)=>`<svg viewBox="${vb||(k==='fish'?'0 0 64 64':'0 0 24 24')}" fill="none" stroke="currentColor" stroke-width="${k==='fish'?2.5:1.8}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`;
AO.icon=icon;
AO.FISH=icon('fish');
AO.MSGR='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.5 2 2 6.1 2 11.2c0 2.9 1.4 5.5 3.7 7.2V22l3.4-1.9c.9.3 1.9.4 2.9.4 5.5 0 10-4.1 10-9.2S17.5 2 12 2zm1 12.4-2.5-2.7-5 2.7 5.5-5.8 2.6 2.7 4.9-2.7-5.5 5.8z"/></svg>';
const catIcon=c=>/fish|isda|guppy|betta|arowana|cichlid|koi|gold/i.test(c)?'fish':/plant|moss|fern/i.test(c)?'plant':/food|feed|pellet/i.test(c)?'food':'gear';

AO.stockLine=i=>{
  if(i.stock>0) return i.stock<=3?`<p class="stock low"><i></i>Only ${i.stock} left</p>`:`<p class="stock on"><i></i>${i.stock} on hand</p>`;
  if(i.pre) return `<p class="stock pre"><i></i>Pre-order${i.eta?' · arrives '+esc(AO.fmtEta(i.eta)):''}</p>`;
  return '<p class="stock out"><i></i>Sold out</p>';
};
AO.tag=i=>AO.hasPrice(i)?`<span class="tag${AO.onSale(i)?' sale':''}">${AO.onSale(i)?`<s>${AO.peso(i.price)}</s>`:''}${AO.peso(AO.priceOf(i))}</span>`:'';
AO.badges=(i,now)=>[AO.isNew(i,now)&&'<span class="b new">New</span>',AO.onSale(i)&&'<span class="b sale">Sale</span>',AO.isPre(i)&&'<span class="b pre">Pre-order</span>',AO.isOut(i)&&'<span class="b out">Sold out</span>'].filter(Boolean).join('');
AO.alt=i=>[i.name,i.size,i.sub||i.cat].filter(Boolean).join(' – ');
AO.meta=i=>[i.size,i.sub||i.cat].filter(Boolean).join(' · ');
/* the main button of an item: ask the price, add to the order list, or ask when it is back */
AO.action=(i,ctx,cls)=>{
  const s=ctx.shop, n=ctx.inOrder?ctx.inOrder(i.id):0, url=ctx.abs?ctx.abs(i):'';
  if(AO.isOut(i)) return `<a class="${cls}" href="${esc(AO.msgLink(s,AO.backText(s,i)))}" target="_blank" rel="noopener">Ask when it's back</a>`;
  if(!AO.hasPrice(i)) return `<a class="${cls} ask" href="${esc(AO.msgLink(s,AO.askText(s,i,url)))}" target="_blank" rel="noopener">${AO.MSGR}<span>Ask price</span></a>`;
  return `<button class="${cls}${n?' in':''}" type="button" data-add="${esc(i.id)}">${n?'In your order ('+n+')':AO.isPre(i)?'Add pre-order':'Add to order'}</button>`;
};
/* ctx: {shop, now, img(i) -> url|'' (no photo)|null (load later), href(i), abs(i), inOrder(id)} */
AO.card=(i,ctx)=>{
  const im=ctx.img(i), href=ctx.href(i);
  const pic=im?`<img src="${esc(im)}" alt="${esc(AO.alt(i))}" width="480" height="480" loading="lazy" decoding="async">`
    :`<span class="ph">${AO.FISH}</span>${im===null?`<img data-lazy="${esc(i.id)}" alt="${esc(AO.alt(i))}" width="480" height="480" hidden>`:''}`;
  return `<article class="item${AO.isOut(i)?' out':''}" data-id="${esc(i.id)}">
<a class="photo" href="${esc(href)}" data-open="${esc(i.id)}" tabindex="-1" aria-hidden="true">${pic}${AO.tag(i)}<span class="badges">${AO.badges(i,ctx.now)}</span></a>
<div class="body"><h3 class="name"><a href="${esc(href)}" data-open="${esc(i.id)}">${esc(i.name)}</a></h3><p class="meta">${esc(AO.meta(i))}</p>${AO.stockLine(i)}${AO.action(i,ctx,'add')}</div>
</article>`;
};
AO.rank=i=>AO.isOut(i)?2:AO.isPre(i)?1:0;
AO.sort=(L,now)=>L.slice().sort((a,b)=>AO.rank(a)-AO.rank(b)||(AO.isNew(b,now)-AO.isNew(a,now))||a.name.localeCompare(b.name)||(a.size||'').localeCompare(b.size||''));
AO.FILTERS=[['all','All available',AO.avail],['on','On hand',i=>i.stock>0],['pre','Pre-order',AO.isPre],['new','New arrivals',i=>AO.isNew(i)&&AO.avail(i)],['sale','On sale',i=>AO.onSale(i)&&AO.avail(i)],['out','Sold out',AO.isOut]];
AO.chips=(items,filt,sub)=>{
  const subs=[...new Set(items.filter(AO.avail).map(i=>i.sub).filter(Boolean))].sort();
  return AO.FILTERS.filter(([k,,f])=>k==='all'||items.some(f)).map(([k,l,f])=>`<button class="chip" type="button" aria-pressed="${filt===k}" data-f="${k}">${l}<b>${items.filter(f).length}</b></button>`).join('')
    +(subs.length>1?'<span class="sep" aria-hidden="true"></span>'+subs.map(c=>`<button class="chip" type="button" aria-pressed="${sub===c}" data-c="${esc(c)}">${esc(c)}</button>`).join(''):'');
};

/* categories (the app's main item types: Fish, Accessories, …) */
AO.cats=items=>{ const m=new Map(); items.forEach(i=>{ const c=i.cat||'Items'; if(!m.has(c)) m.set(c,{name:c,slug:AO.slug(c),avail:0,total:0}); const x=m.get(c); x.total++; if(AO.avail(i)) x.avail++; });
  const L=[...m.values()].sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name)); const seen={};
  L.forEach(c=>{ let s=c.slug,k=2; while(seen[s]) s=c.slug+'-'+k++; seen[s]=1; c.slug=s; }); return L; };
/* nav tabs; ctx.catHref(slug), ctx.home (link to the shop's front page) */
AO.nav=(cats,active,ctx)=>`<nav class="tabs" id="tabs" aria-label="Shop sections"><div class="wrap tabs-in">
<a href="${esc(ctx.home)}" class="tab${active==='home'?' on':''}"${active==='home'?' aria-current="page"':''}>Home</a>
${cats.map(c=>`<a href="${esc(ctx.catHref(c.slug))}" class="tab${active===c.slug?' on':''}"${active===c.slug?' aria-current="page"':''}>${esc(c.name)}<b>${c.avail}</b></a>`).join('')}
<a href="${esc(ctx.home)}#about" class="tab">About</a><a href="${esc(ctx.home)}#visit" class="tab">Visit us</a></div></nav>`;

/* top of every page */
AO.hero=(s,items,o)=>{ // o: {logo, photo, h1, slim, home, cats, ctx, mapq}
  const l=AO.msgLink(s,''), where=String(s.address||'').split('\n')[0], tag=o.h1?'h1':'p';
  if(o.slim) return `<header class="hero slim" id="hero"><div class="rays" aria-hidden="true"></div><div class="wrap hero-in"><a class="brand" href="${esc(o.home)}">${o.logo?`<img class="logo" src="${esc(o.logo)}" alt="${esc(s.name)} logo" width="46" height="46">`:''}<span class="shopname">${esc(s.name)}</span></a>
${l?`<a class="msgr sm" href="${esc(l)}" target="_blank" rel="noopener">${AO.MSGR}<span>Message us</span></a>`:''}</div></header>`;
  const first=o.cats&&o.cats[0];
  return `<header class="hero${o.photo?' has-photo':''}" id="hero">${o.photo?`<img class="hero-photo" src="${esc(o.photo)}" alt="" fetchpriority="high">`:''}<div class="rays" aria-hidden="true"></div><div class="caustics" aria-hidden="true"></div>
<div class="wrap hero-in"><div class="brand">${o.logo?`<img class="logo" id="logo" src="${esc(o.logo)}" alt="${esc(s.name)} logo" width="76" height="76">`:''}
<div class="brand-t"><${tag} class="shopname" id="sname">${esc(s.name||'Shop page')}</${tag}>${s.motto?`<p class="motto">${esc(s.motto)}</p>`:s.tagline?`<p class="tagline">${esc(s.tagline)}</p>`:''}
${where?`<p class="where">${icon('where')}${esc(where)}${s.started?` · since ${esc(s.started)}`:''}</p>`:''}</div></div>
<div class="hero-row">${first?`<a class="cta" href="${esc(o.ctx.catHref(first.slug))}">See ${esc(first.name.toLowerCase())} available</a>`:''}${l?`<a class="msgr" id="msgr" href="${esc(l)}" target="_blank" rel="noopener">${AO.MSGR}<span>Message us</span></a>`:''}
${o.mapq?`<a class="ghost-btn" href="${esc(AO.directions(s,o.mapq))}" target="_blank" rel="noopener">${icon('route')}<span>Directions</span></a>`:''}</div></div></header>`;
};

/* front page sections */
AO.tiles=(cats,items,ctx)=>`<section class="wrap sect" id="browse" aria-labelledby="hBrowse"><h2 class="sh" id="hBrowse">What we have</h2>
<div class="tiles">${cats.map(c=>{ const pic=items.find(i=>i.cat===c.name&&AO.avail(i)&&ctx.img(i))||items.find(i=>i.cat===c.name&&ctx.img(i)); const im=pic?ctx.img(pic):'';
  return `<a class="tile" href="${esc(ctx.catHref(c.slug))}">${im?`<img src="${esc(im)}" alt="" loading="lazy" decoding="async" width="480" height="480">`:`<span class="ph">${icon(catIcon(c.name))}</span>`}
<span class="tile-t"><b>${esc(c.name)}</b><span>${c.avail} available</span></span></a>`; }).join('')}</div></section>`;
AO.strip=(items,ctx)=>{ const L=AO.sort(items.filter(i=>AO.isNew(i,ctx.now)&&AO.avail(i)),ctx.now).slice(0,12); if(!L.length) return '';
  return `<section class="wrap sect" id="fresh" aria-labelledby="hNew"><h2 class="sh" id="hNew">New arrivals</h2><div class="strip">${L.map(i=>AO.card(i,ctx)).join('')}</div></section>`; };
AO.about=s=>{ if(!(s.about||s.motto||s.vision||s.mission)) return '';
  return `<section class="wrap sect about" id="about" aria-labelledby="hAbout"><h2 class="sh" id="hAbout">About ${esc(s.name)}</h2>
${s.about?`<p class="lead">${esc(s.about)}</p>`:''}${s.motto?`<blockquote class="motto-q"><p>${esc(s.motto)}</p></blockquote>`:''}
${s.vision||s.mission?`<div class="vm">${s.vision?`<div class="panel">${icon('vision')}<h3>Vision</h3><p>${esc(s.vision)}</p></div>`:''}${s.mission?`<div class="panel">${icon('mission')}<h3>Mission</h3><p>${esc(s.mission)}</p></div>`:''}</div>`:''}</section>`; };
AO.gallery=(gal,s)=>gal.length?`<section class="wrap sect" aria-labelledby="hGal"><h2 class="sh" id="hGal">Inside the shop</h2><div class="gal">${gal.map((g,k)=>`<figure class="${k===0&&gal.length>2?'wide':''}"><img src="${esc(g.src)}" alt="${esc(g.cap||s.name+' store photo')}" loading="lazy" decoding="async" width="1200" height="900">${g.cap?`<figcaption>${esc(g.cap)}</figcaption>`:''}</figure>`).join('')}</div></section>`:'';
AO.services=s=>{ const L=String(s.services||'').split('\n').map(x=>x.replace(/^[\s•*\-–]+/,'').trim()).filter(Boolean).slice(0,12); if(!L.length) return '';
  return `<section class="wrap sect" id="services" aria-labelledby="hServ"><h2 class="sh" id="hServ">Services</h2><div class="serv">${L.map(x=>{ const m=/^(.{2,60}?)\s*(?:—|–| - |:)\s*(.+)$/.exec(x);
    return `<div class="panel">${icon('service')}<h3>${esc(m?m[1]:x)}</h3>${m?`<p>${esc(m[2])}</p>`:''}</div>`; }).join('')}</div></section>`; };
AO.steps=(s,ask)=>`<section class="wrap sect" aria-labelledby="hHow"><h2 class="sh" id="hHow">How to order</h2><ol class="steps">
<li><b>Choose</b><span>Browse what is on hand or on pre-order${ask?'.':' and add it to your order.'}</span></li>
<li><b>Message us</b><span>${ask?'Tap <em>Ask price</em> — Messenger opens with the item already typed in.':'Tap <em>Send order on Messenger</em> — your list is typed in for you.'}</span></li>
<li><b>Pick up or get it delivered</b><span>${s.delivery?esc(String(s.delivery).split('\n')[0]):'We confirm the details with you on Messenger.'}</span></li></ol></section>`;
AO.visit=(s,mapq)=>{ const l=AO.msgLink(s,''), ph=AO.phone(s), b=[];
  if(s.hours) b.push(['hours','Open hours',esc(s.hours)]);
  if(s.address) b.push(['where','Address',esc(s.address)]);
  if(s.delivery) b.push(['delivery','Delivery',esc(s.delivery)]);
  if(s.payment) b.push(['payment','Payment',esc(s.payment)]);
  return `<section class="wrap sect" id="visit" aria-labelledby="hVisit"><h2 class="sh" id="hVisit">Visit us</h2><div class="visit">
${mapq?`<div class="map"><iframe title="Map to ${esc(s.name)}" src="${esc(AO.mapEmbed(mapq))}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>`:''}
<div class="vinfo">${b.map(([k,h,t])=>`<div class="vrow">${icon(k)}<div><h3>${h}</h3><p>${t}</p></div></div>`).join('')}
<div class="vbtn">${l?`<a class="go" href="${esc(l)}" target="_blank" rel="noopener">${AO.MSGR}<span>Message us</span></a>`:''}${ph?`<a href="tel:${esc(ph.replace(/[^\d+]/g,''))}">${icon('call')}<span>Call ${esc(ph)}</span></a>`:''}${mapq?`<a href="${esc(AO.directions(s,mapq))}" target="_blank" rel="noopener">${icon('route')}<span>Directions</span></a>`:''}</div></div></div></section>`; };
AO.foot=(s,cats,ctx)=>`<footer class="foot"><div class="wrap foot-in"><div><b class="fname">${esc(s.name)}</b>${s.motto?`<p>${esc(s.motto)}</p>`:''}</div>
<nav aria-label="Footer"><a href="${esc(ctx.home)}">Home</a>${cats.map(c=>`<a href="${esc(ctx.catHref(c.slug))}">${esc(c.name)}</a>`).join('')}<a href="${esc(ctx.home)}#about">About</a><a href="${esc(ctx.home)}#visit">Visit us</a>${AO.fbPage(s)?`<a href="${esc(AO.fbPage(s))}" target="_blank" rel="noopener">Facebook</a>`:''}</nav>
<p class="made">Shop page made with <b>Aquatic Ops</b></p></div></footer>`;
AO.fab=s=>{ const l=AO.msgLink(s,''); return l?`<a class="fab" href="${esc(l)}" target="_blank" rel="noopener" aria-label="Message ${esc(s.name)} on Messenger">${AO.MSGR}</a>`:''; };
AO.home=(s,items,gal,ctx,mapq)=>{ const cats=AO.cats(items);
  return AO.tiles(cats,items,ctx)+AO.strip(items,ctx)+AO.about(s)+AO.gallery(gal,s)+AO.services(s)+AO.steps(s,AO.askMode(s,items))+AO.visit(s,mapq); };
AO.catPage=(cat,items,ctx)=>`<div class="tools" id="tools"><div class="wrap"><h1 class="cat-h">${esc(cat.name)}</h1>
<label class="search">${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>'}
<input id="q" type="search" placeholder="Search ${esc(cat.name.toLowerCase())}…" aria-label="Search ${esc(cat.name)}" autocomplete="off" enterkeyhint="search"></label>
<div class="chips" id="chips" role="toolbar" aria-label="Filter">${AO.chips(items,'all','')}</div></div></div>
<main class="wrap" id="items"><div id="main">${AO.grid(items,'all','','',ctx)}</div></main>`;
AO.grid=(items,filt,sub,q,ctx)=>{ const f=AO.FILTERS.find(x=>x[0]===filt)[2];
  const L=AO.sort(items.filter(i=>f(i)&&(!sub||i.sub===sub)&&(!q||(i.name+' '+(i.size||'')+' '+(i.sub||'')).toLowerCase().includes(q))),ctx.now);
  return L.length?'<div class="grid">'+L.map(i=>AO.card(i,ctx)).join('')+'</div>':`<p class="empty">${items.length?'Nothing here right now. Try another filter, or message us — we may have it soon.':'No items posted yet. Message us to ask what is available.'}</p>`; };
AO.orderText=(s,lines)=>{ const tot=lines.reduce((a,x)=>a+x.n*AO.priceOf(x.i),0);
  return `Hi ${s.name}! Gusto ko po i-order:\n`+lines.map(x=>`• ${x.n} x ${AO.label(x.i)} — ${AO.peso(AO.priceOf(x.i)*x.n)}${AO.isPre(x.i)?' [pre-order]':''}`).join('\n')+`\nTotal: ${AO.peso(tot)}\n\nAvailable pa po ba?`; };
AO.schemaAvail=i=>i.stock>0?'https://schema.org/InStock':i.pre?'https://schema.org/PreOrder':'https://schema.org/OutOfStock';
})(typeof window!=='undefined'?window:globalThis);
