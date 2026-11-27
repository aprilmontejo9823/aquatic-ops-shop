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
AO.onSale=i=>i.sale!=null&&i.sale>0&&i.sale<i.price;
AO.isPre=i=>!!i.pre&&!(i.stock>0);
AO.isOut=i=>!(i.stock>0)&&!i.pre;
AO.priceOf=i=>AO.onSale(i)?i.sale:i.price;
AO.label=i=>i.name+(i.size?' ('+i.size+')':'');
AO.fmtEta=e=>{ if(/^\d{4}-\d{2}-\d{2}$/.test(e||'')){ const d=new Date(e+'T00:00:00'); return d.toLocaleDateString('en-PH',{month:'short',day:'numeric'}); } return e||''; };

/* Messenger: the shop's Facebook page. Falls back to a facebook link typed in the phone field. */
const FBRE=/(?:m\.me|facebook\.com|fb\.com|messenger\.com\/t)\/([^/?#\s]+)/i;
AO.msgUser=s=>{ const m=String(s.messenger||'').trim(); const x=FBRE.exec(m)||FBRE.exec(String(s.phone||'')); if(x) return x[1].replace(/^@/,''); return /^@?[\w.]{3,60}$/.test(m)?m.replace(/^@/,''):''; };
AO.msgLink=(s,text)=>{ const u=AO.msgUser(s); return u?`https://m.me/${encodeURIComponent(u)}${text?'?text='+encodeURIComponent(text):''}`:''; };
AO.fbPage=s=>{ const u=AO.msgUser(s); return u?'https://www.facebook.com/'+encodeURIComponent(u):''; };
AO.phone=s=>{ const p=String(s.phone||'').trim(); return /^[+\d][\d\s().-]{6,}$/.test(p)?p:''; };
AO.safeUrl=u=>{ try{ const x=new URL(u); return x.protocol==='https:'?x.href:''; }catch(e){ return ''; } };

AO.FISH='<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 32c8-12 22-16 34-10l12-8v36l-12-8C30 48 16 44 8 32z"/><circle cx="20" cy="29" r="2.4" fill="currentColor"/></svg>';
AO.MSGR='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.5 2 2 6.1 2 11.2c0 2.9 1.4 5.5 3.7 7.2V22l3.4-1.9c.9.3 1.9.4 2.9.4 5.5 0 10-4.1 10-9.2S17.5 2 12 2zm1 12.4-2.5-2.7-5 2.7 5.5-5.8 2.6 2.7 4.9-2.7-5.5 5.8z"/></svg>';

AO.stockLine=i=>{
  if(i.stock>0) return i.stock<=3?`<p class="stock low"><i></i>Only ${i.stock} left</p>`:`<p class="stock on"><i></i>${i.stock} on hand</p>`;
  if(i.pre) return `<p class="stock pre"><i></i>Pre-order${i.eta?' · arrives '+esc(AO.fmtEta(i.eta)):''}</p>`;
  return '<p class="stock out"><i></i>Sold out</p>';
};
AO.tag=i=>`<span class="tag${AO.onSale(i)?' sale':''}">${AO.onSale(i)?`<s>${AO.peso(i.price)}</s>`:''}${AO.peso(AO.priceOf(i))}</span>`;
AO.badges=(i,now)=>[AO.isNew(i,now)&&'<span class="b new">New</span>',AO.onSale(i)&&'<span class="b sale">Sale</span>',AO.isPre(i)&&'<span class="b pre">Pre-order</span>',AO.isOut(i)&&'<span class="b out">Sold out</span>'].filter(Boolean).join('');
AO.alt=i=>[i.name,i.size,i.cat].filter(Boolean).join(' – ');
/* ctx: {img(i) -> url|'' (no photo)|null (unknown, load later), href(i), inOrder(id), now} */
AO.card=(i,ctx)=>{
  const im=ctx.img(i), href=ctx.href(i), n=ctx.inOrder?ctx.inOrder(i.id):0;
  const pic=im?`<img src="${esc(im)}" alt="${esc(AO.alt(i))}" width="480" height="480" loading="lazy" decoding="async">`
    :`<span class="ph">${AO.FISH}</span>${im===null?`<img data-lazy="${esc(i.id)}" alt="${esc(AO.alt(i))}" width="480" height="480" hidden>`:''}`;
  const act=AO.isOut(i)?`<a class="add" href="${esc(AO.msgLink(ctx.shop,'Hi! Kailan po babalik ang '+AO.label(i)+'?'))}" target="_blank" rel="noopener">Ask when it's back</a>`
    :`<button class="add${n?' in':''}" type="button" data-add="${esc(i.id)}">${n?'In your order ('+n+')':AO.isPre(i)?'Add pre-order':'Add to order'}</button>`;
  return `<article class="item${AO.isOut(i)?' out':''}" data-id="${esc(i.id)}">
<a class="photo" href="${esc(href)}" data-open="${esc(i.id)}" tabindex="-1" aria-hidden="true">${pic}${AO.tag(i)}<span class="badges">${AO.badges(i,ctx.now)}</span></a>
<div class="body"><h3 class="name"><a href="${esc(href)}" data-open="${esc(i.id)}">${esc(i.name)}</a></h3><p class="meta">${esc([i.size,i.cat].filter(Boolean).join(' · '))}</p>${AO.stockLine(i)}${act}</div>
</article>`;
};
AO.FILTERS=[['all','All',()=>true],['on','On hand',i=>i.stock>0],['pre','Pre-order',AO.isPre],['new','New arrivals',i=>AO.isNew(i)],['sale','On sale',AO.onSale]];
AO.rank=i=>AO.isOut(i)?2:AO.isPre(i)?1:0;
AO.sort=(L,now)=>L.slice().sort((a,b)=>AO.rank(a)-AO.rank(b)||(AO.isNew(b,now)-AO.isNew(a,now))||a.name.localeCompare(b.name)||(a.size||'').localeCompare(b.size||''));
AO.chips=(items,filt,cat)=>{
  const cats=[...new Set(items.map(i=>i.cat).filter(Boolean))].sort();
  return AO.FILTERS.filter(([k,,f])=>k==='all'||items.some(f)).map(([k,l,f])=>`<button class="chip" type="button" aria-pressed="${filt===k}" data-f="${k}">${l}<b>${items.filter(f).length}</b></button>`).join('')
    +(cats.length>1?'<span class="sep" aria-hidden="true"></span>'+cats.map(c=>`<button class="chip" type="button" aria-pressed="${cat===c}" data-c="${esc(c)}">${esc(c)}</button>`).join(''):'');
};
const ICON={
  hours:'<path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="9"/>',
  where:'<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  delivery:'<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  payment:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
  contact:'<path d="M4 5h16v11H8l-4 4z"/>',
  about:'<path d="M8 32c8-12 22-16 34-10l12-8v36l-12-8C30 48 16 44 8 32z" transform="scale(.375)"/>'};
const icon=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;
AO.info=s=>{
  const b=[], l=AO.msgLink(s,''), ph=AO.phone(s), map=AO.safeUrl(s.map);
  if(s.hours) b.push(['hours','Open hours',esc(s.hours)]);
  if(s.address) b.push(['where','Where to find us',esc(s.address)+(map?`<br><a href="${esc(map)}" target="_blank" rel="noopener">Open in Google Maps</a>`:'')]);
  if(s.delivery) b.push(['delivery','Delivery',esc(s.delivery)]);
  if(s.payment) b.push(['payment','Payment',esc(s.payment)]);
  const c=[ph&&`<a href="tel:${esc(ph.replace(/[^\d+]/g,''))}">${esc(ph)}</a>`,l&&`<a href="${esc(l)}" target="_blank" rel="noopener">Message us on Messenger</a>`].filter(Boolean).join('<br>');
  if(c) b.push(['contact','Contact',c]);
  if(s.about) b.push(['about','About the shop',esc(s.about)]);
  return b.map(([k,h,t])=>`<div class="panel">${icon(k)}<h2>${h}</h2><p>${t}</p></div>`).join('');
};
AO.heroStats=items=>{ const on=items.filter(i=>i.stock>0).length, pre=items.filter(AO.isPre).length, nw=items.filter(i=>AO.isNew(i)).length;
  return [on&&`<li><b>${on}</b> on hand</li>`,pre&&`<li><b>${pre}</b> on pre-order</li>`,nw&&`<li><b>${nw}</b> new arrivals</li>`].filter(Boolean).join(''); };
AO.orderText=(s,lines)=>{ const tot=lines.reduce((a,x)=>a+x.n*AO.priceOf(x.i),0);
  return `Hi ${s.name}! Gusto ko po i-order:\n`+lines.map(x=>`• ${x.n} x ${AO.label(x.i)} — ${AO.peso(AO.priceOf(x.i)*x.n)}${AO.isPre(x.i)?' [pre-order]':''}`).join('\n')+`\nTotal: ${AO.peso(tot)}\n\nAvailable pa po ba?`; };
AO.avail=i=>i.stock>0?'https://schema.org/InStock':i.pre?'https://schema.org/PreOrder':'https://schema.org/OutOfStock';
})(typeof window!=='undefined'?window:globalThis);
(function(G){
'use strict';
const AO=G.AO, esc=AO.esc;
/* hero: logo, name, tagline, where, live counts, Messenger */
AO.hero=(s,items,logo,h1)=>{
  const l=AO.msgLink(s,''), where=String(s.address||'').split('\n')[0];
  return `<div class="brand">${logo?`<img class="logo" id="logo" src="${esc(logo)}" alt="${esc(s.name)} logo" width="76" height="76">`:''}
<div class="brand-t"><${h1?'h1':'p'} class="shopname" id="sname">${esc(s.name||'Shop page')}</${h1?'h1':'p'}>${s.tagline?`<p class="tagline">${esc(s.tagline)}</p>`:''}${where?`<p class="where"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>${esc(where)}</p>`:''}</div></div>
<div class="hero-row"><ul class="stats" id="stats">${AO.heroStats(items)}</ul>${l?`<a class="msgr" id="msgr" href="${esc(l)}" target="_blank" rel="noopener">${AO.MSGR}<span>Message us</span></a>`:''}</div>`;
};
})(typeof window!=='undefined'?window:globalThis);
