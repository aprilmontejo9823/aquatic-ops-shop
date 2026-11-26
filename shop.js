'use strict';
const FB={key:'AIzaSyBhh9xX0ddpa7-GMfFlcFBg6pF_pR3NWOw',base:'https://firestore.googleapis.com/v1/projects/aquatic-ops/databases/(default)/documents'};
const SHOP=(document.body.dataset.shop||new URLSearchParams(location.search).get('s')||'').toLowerCase().replace(/[^a-z0-9-]/g,'');
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const peso=n=>'₱'+Number(n||0).toLocaleString('en-PH',{maximumFractionDigits:2});
const DAY=864e5, NEWDAYS=14;
function val(v){ if(!v) return null; if('stringValue' in v) return v.stringValue; if('integerValue' in v) return +v.integerValue; if('doubleValue' in v) return v.doubleValue;
  if('booleanValue' in v) return v.booleanValue; if('nullValue' in v) return null; if('timestampValue' in v) return Date.parse(v.timestampValue);
  if('mapValue' in v) return obj(v.mapValue.fields||{}); if('arrayValue' in v) return (v.arrayValue.values||[]).map(val); return null; }
const obj=f=>Object.fromEntries(Object.entries(f).map(([k,v])=>[k,val(v)]));
let shop=null, items=[], filt='all', cat='', q='', order=JSON.parse(sessionStorage.getItem('ao_order_'+SHOP)||'{}');
const today=()=>new Date().toISOString().slice(0,10);

async function load(){
  if(!SHOP){ state('Shop not found','Check the link the shop sent you.'); return; }
  try{
    const r=await fetch(`${FB.base}/shops/${SHOP}?key=${FB.key}`);
    if(r.status===404){ state('Shop not found','Check the link the shop sent you.'); return; }
    if(!r.ok) throw new Error(r.status);
    shop=obj((await r.json()).fields||{});
  }catch(e){ state('Could not load the shop','Check your internet connection, then reload the page.',true); return; }
  if(!shop.active||(shop.until&&shop.until<today())){ state(shop.name||'Shop page','This shop page is not open right now. Message the shop on Facebook.'); return; }
  paintShop();
  try{
    const mask=['name','size','cat','price','sale','stock','pre','eta','care','since','updated'].map(f=>'mask.fieldPaths='+f).join('&');
    let page='', all=[];
    do{ const r=await fetch(`${FB.base}/shops/${SHOP}/items?pageSize=300&${mask}&key=${FB.key}${page?'&pageToken='+page:''}`); if(!r.ok) throw new Error(r.status);
      const d=await r.json(); (d.documents||[]).forEach(doc=>all.push({id:doc.name.split('/').pop(),...obj(doc.fields||{})})); page=d.nextPageToken||''; }while(page);
    items=all.filter(i=>i.name);
  }catch(e){ $('main').innerHTML='<p class="empty">Could not load the items. Check your internet connection, then reload the page.</p>'; return; }
  Object.keys(order).forEach(id=>{ if(!items.find(i=>i.id===id)) delete order[id]; });
  renderChips(); render(); drawBar();
  const m=/[#&]i=([\w-]+)/.exec(location.hash); if(m&&items.find(i=>i.id===m[1])) openItem(m[1]);
}
function state(h,p,retry){ $('tools').classList.add('hide'); $('main').innerHTML=`<div class="state"><h1>${esc(h)}</h1><p>${esc(p)}</p>${retry?'<button class="add" onclick="location.reload()">Reload</button>':''}</div>`;
  if(shop&&shop.name){ $('sname').textContent=shop.name; } else $('sname').textContent='Shop page'; }
function msgUser(){ const m=String(shop.messenger||'').trim(); if(!m) return ''; const x=/(?:m\.me|facebook\.com|fb\.com|messenger\.com\/t)\/([^/?#]+)/i.exec(m); return (x?x[1]:m).replace(/^@/,''); }
function msgLink(text){ const u=msgUser(); return u?`https://m.me/${encodeURIComponent(u)}${text?'?text='+encodeURIComponent(text):''}`:''; }
function paintShop(){
  document.title=shop.name+(shop.tagline?' — '+shop.tagline:'');
  if(/^#[0-9a-f]{6}$/i.test(shop.color||'')){ document.documentElement.style.setProperty('--accent',shop.color); document.querySelector('meta[name=theme-color]').content=shop.color; }
  $('sname').textContent=shop.name||''; $('stag').textContent=[shop.tagline,shop.address&&shop.address.split('\n')[0]].filter(Boolean).join(' — ');
  if(/^data:image\/(png|jpeg|webp);base64,/.test(shop.logo||'')){ $('logo').src=shop.logo; $('logo').classList.remove('hide'); }
  const l=msgLink(''); if(l){ $('msgr').href=l; $('msgr').classList.remove('hide'); }
  const blocks=[];
  if(shop.hours) blocks.push(['Open hours',esc(shop.hours)]);
  if(shop.address) blocks.push(['Where to find us',esc(shop.address)+(safeUrl(shop.map)?`<br><a href="${esc(safeUrl(shop.map))}" target="_blank" rel="noopener">Open in Google Maps</a>`:'')]);
  if(shop.delivery) blocks.push(['Delivery',esc(shop.delivery)]);
  if(shop.payment) blocks.push(['Payment',esc(shop.payment)]);
  const contact=[shop.phone&&`<a href="tel:${esc(String(shop.phone).replace(/[^\d+]/g,''))}">${esc(shop.phone)}</a>`, l&&`<a href="${esc(l)}" target="_blank" rel="noopener">Message us on Messenger</a>`].filter(Boolean).join('<br>');
  if(contact) blocks.push(['Contact',contact]);
  if(shop.about) blocks.push(['About the shop',esc(shop.about)]);
  if(blocks.length){ $('info').innerHTML=blocks.map(([h,b])=>`<div><h2>${h}</h2><p>${b}</p></div>`).join(''); $('info').classList.remove('hide'); }
}
function safeUrl(u){ try{ const x=new URL(u); return /^https:$/.test(x.protocol)?x.href:''; }catch(e){ return ''; } }
const isNew=i=>i.since&&Date.now()-i.since<NEWDAYS*DAY;
const onSale=i=>i.sale!=null&&i.sale>0&&i.sale<i.price;
const isPre=i=>!!i.pre&&!(i.stock>0);
const isOut=i=>!(i.stock>0)&&!i.pre;
const priceOf=i=>onSale(i)?i.sale:i.price;
const FILTERS=[['all','All',()=>true],['on','On hand',i=>i.stock>0],['pre','Pre-order',isPre],['new','New arrivals',isNew],['sale','On sale',onSale]];
function renderChips(){
  const cats=[...new Set(items.map(i=>i.cat).filter(Boolean))].sort();
  $('chips').innerHTML=FILTERS.filter(([k,,f])=>k==='all'||items.some(f)).map(([k,l,f])=>`<button class="chip" aria-pressed="${filt===k}" onclick="setF('${k}')">${l}<b>${items.filter(f).length}</b></button>`).join('')
    +(cats.length>1?'<span class="sep"></span>'+cats.map(c=>`<button class="chip" aria-pressed="${cat===c}" onclick="setC(${esc(JSON.stringify(c))})">${esc(c)}</button>`).join(''):'');
}
window.setF=k=>{ filt=k; renderChips(); render(); };
window.setC=c=>{ cat=cat===c?'':c; renderChips(); render(); };
$('q').addEventListener('input',e=>{ q=e.target.value.trim().toLowerCase(); render(); });
function rank(i){ return (isOut(i)?2:isPre(i)?1:0); }
function render(){
  const f=FILTERS.find(x=>x[0]===filt)[2];
  const L=items.filter(i=>f(i)&&(!cat||i.cat===cat)&&(!q||(i.name+' '+(i.size||'')+' '+(i.cat||'')).toLowerCase().includes(q)))
    .sort((a,b)=>rank(a)-rank(b)||(isNew(b)-isNew(a))||a.name.localeCompare(b.name));
  if(!L.length){ $('main').innerHTML=`<p class="empty">${items.length?'No items match. Try another word or filter.':'No items posted yet. Message the shop to ask what is available.'}</p>`; return; }
  $('main').innerHTML='<div class="grid">'+L.map(card).join('')+'</div>'; lazyImages();
}
function stockLine(i){
  if(i.stock>0) return `<div class="stock${i.stock<=3?' low':''}">${i.stock<=3?'Only '+i.stock+' left':i.stock+' on hand'}</div>`;
  if(i.pre) return `<div class="stock pre">Pre-order${i.eta?' — arrives '+esc(fmtEta(i.eta)):''}</div>`;
  return '<div class="stock" style="color:var(--out)">Sold out</div>';
}
function fmtEta(e){ if(/^\d{4}-\d{2}-\d{2}$/.test(e)){ const d=new Date(e+'T00:00:00'); return d.toLocaleDateString('en-PH',{month:'short',day:'numeric'}); } return e; }
const FISH='<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 32c8-12 22-16 34-10l12-8v36l-12-8C30 48 16 44 8 32z"/><circle cx="20" cy="29" r="2.5" fill="currentColor"/></svg>';
function card(i){
  const inO=order[i.id], b=[isNew(i)&&'<span class="b new">New</span>',onSale(i)&&'<span class="b sale">Sale</span>',isPre(i)&&'<span class="b pre">Pre-order</span>',isOut(i)&&'<span class="b out">Sold out</span>'].filter(Boolean).join('');
  return `<article class="item${isOut(i)?' out':''}">
    <button class="photo" style="border:0;padding:0" onclick="openItem('${i.id}')" aria-label="View ${esc(i.name)}"><div class="ph">${FISH}</div><img data-id="${i.id}" alt="" class="hide">
      <span class="tag${onSale(i)?' sale':''}">${onSale(i)?`<s>${peso(i.price)}</s>`:''}${peso(priceOf(i))}</span><span class="badges">${b}</span></button>
    <h2 class="name">${esc(i.name)}</h2><div class="meta">${esc([i.size,i.cat].filter(Boolean).join(', '))}</div>${stockLine(i)}
    ${isOut(i)?`<a class="add" style="text-align:center;text-decoration:none" target="_blank" rel="noopener" href="${esc(msgLink('Hi! Kailan po babalik ang '+i.name+(i.size?' ('+i.size+')':'')+'?'))}">Ask when it's back</a>`
      :`<button class="add${inO?' in':''}" onclick="toggle('${i.id}')">${inO?'In your order ('+inO+')':isPre(i)?'Add pre-order':'Add to order'}</button>`}
  </article>`;
}
// images load only when they scroll into view
const imgCache={}; let io=null;
function lazyImages(){
  if(io) io.disconnect();
  io=new IntersectionObserver(es=>{ const ids=es.filter(e=>e.isIntersecting).map(e=>{ io.unobserve(e.target); return e.target.querySelector('img[data-id]').dataset.id; }); if(ids.length) fetchImgs(ids); },{rootMargin:'300px'});
  document.querySelectorAll('.grid img[data-id]').forEach(im=>{ if(imgCache[im.dataset.id]!==undefined) showImg(im.dataset.id); else io.observe(im.parentElement); });
}
let pend=[], tmr=null;
function fetchImgs(ids){ pend.push(...ids); clearTimeout(tmr); tmr=setTimeout(async()=>{ const b=[...new Set(pend)].filter(id=>imgCache[id]===undefined); pend=[]; if(!b.length) return;
  for(let k=0;k<b.length;k+=20){ const part=b.slice(k,k+20);
    try{ const r=await fetch(`${FB.base}:batchGet?key=${FB.key}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documents:part.map(id=>FB.base.split('/v1/')[1]+'/shops/'+SHOP+'/items/'+id),mask:{fieldPaths:['img']}})});
      (await r.json()).forEach(x=>{ if(x.found){ const id=x.found.name.split('/').pop(), v=val((x.found.fields||{}).img); imgCache[id]=/^data:image\/(jpeg|webp|png);base64,/.test(v||'')?v:''; showImg(id); } });
      part.forEach(id=>{ if(imgCache[id]===undefined) imgCache[id]=''; });
    }catch(e){} } },60); }
function showImg(id){ const src=imgCache[id]; if(!src) return; document.querySelectorAll(`img[data-id="${id}"]`).forEach(im=>{ im.src=src; im.classList.remove('hide'); const ph=im.previousElementSibling; if(ph&&ph.classList.contains('ph')) ph.remove(); }); }

// order list
window.toggle=id=>{ if(order[id]) delete order[id]; else order[id]=1; saveOrder(); render(); drawBar(); if(order[id]) toast('Added to your order'); };
function saveOrder(){ try{ sessionStorage.setItem('ao_order_'+SHOP,JSON.stringify(order)); }catch(e){} }
function orderLines(){ return Object.entries(order).map(([id,n])=>({i:items.find(x=>x.id===id),n})).filter(x=>x.i); }
function drawBar(){ const L=orderLines(); $('bar').classList.toggle('hide',!L.length); if(!L.length) return;
  const n=L.reduce((a,x)=>a+x.n,0); $('barTot').textContent=peso(L.reduce((a,x)=>a+x.n*priceOf(x.i),0)); $('barN').textContent=n+(n===1?' item':' items')+' in your order'; }
$('barGo').onclick=()=>openOrder();
function sheet(html,label){ $('sheetHost').innerHTML=`<div class="dim" onclick="if(event.target===this)closeSheet()"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}">${html}</div></div>`; document.body.style.overflow='hidden';
  const f=$('sheetHost').querySelector('button,a'); if(f) f.focus(); }
window.closeSheet=()=>{ $('sheetHost').innerHTML=''; document.body.style.overflow=''; if(/i=/.test(location.hash)) history.replaceState(null,'',location.pathname+location.search); };
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&$('sheetHost').innerHTML) closeSheet(); });
window.openItem=id=>{ const i=items.find(x=>x.id===id); if(!i) return; history.replaceState(null,'','#i='+id);
  sheet(`<div class="big"><button class="x" onclick="closeSheet()" aria-label="Close">✕</button><div class="ph photo" style="position:absolute;inset:0;border-radius:0">${FISH}</div><img data-id="${i.id}" alt="${esc(i.name)}" class="hide" style="position:relative"></div>
    <div class="pad"><h3>${esc(i.name)}</h3><div class="meta">${esc([i.size,i.cat].filter(Boolean).join(', '))}</div>
    <div class="price${onSale(i)?' sale':''}">${peso(priceOf(i))}${onSale(i)?`<s>${peso(i.price)}</s>`:''}</div>${stockLine(i)}
    ${i.care?`<div class="care"><h4>Care and info</h4>${esc(i.care)}</div>`:''}
    <div class="row">${isOut(i)?`<a class="go" target="_blank" rel="noopener" href="${esc(msgLink('Hi! Kailan po babalik ang '+i.name+'?'))}">Ask when it's back</a>`:`<button class="go" onclick="toggle('${i.id}');openItem('${i.id}')">${order[i.id]?'Remove from order':isPre(i)?'Add pre-order':'Add to order'}</button>`}
    <button onclick="shareItem('${i.id}')">Share</button></div></div>`, i.name);
  if(imgCache[id]!==undefined) showImg(id); else fetchImgs([id]); };
window.shareItem=async id=>{ const i=items.find(x=>x.id===id); const url=location.origin+location.pathname+'#i='+id, text=`${i.name} — ${peso(priceOf(i))} at ${shop.name}`;
  if(navigator.share){ try{ await navigator.share({title:i.name,text,url}); return; }catch(e){ if(e.name==='AbortError') return; } }
  try{ await navigator.clipboard.writeText(url); toast('Link copied'); }catch(e){ prompt('Copy this link',url); } };
function orderText(){ const L=orderLines(); const tot=L.reduce((a,x)=>a+x.n*priceOf(x.i),0);
  return `Hi ${shop.name}! Gusto ko po i-order:\n`+L.map(x=>`• ${x.n} x ${x.i.name}${x.i.size?' ('+x.i.size+')':''} — ${peso(priceOf(x.i)*x.n)}${isPre(x.i)?' [pre-order]':''}`).join('\n')+`\nTotal: ${peso(tot)}\n\nAvailable pa po ba?`; }
window.openOrder=()=>{ const L=orderLines(); if(!L.length){ closeSheet(); return; }
  sheet(`<div class="pad" style="position:relative"><button class="x" onclick="closeSheet()" aria-label="Close">✕</button><h3>Your order</h3>
    <ul class="ol">${L.map(x=>`<li><div class="n">${esc(x.i.name)}<small>${esc(x.i.size||'')} ${peso(priceOf(x.i))} each${isPre(x.i)?', pre-order':''}</small></div>
      <div class="qty"><button onclick="qty('${x.i.id}',-1)" aria-label="Less">−</button><span>${x.n}</span><button onclick="qty('${x.i.id}',1)" aria-label="More">+</button></div></li>`).join('')}</ul>
    <div class="price">${peso(L.reduce((a,x)=>a+x.n*priceOf(x.i),0))}</div>
    <div class="row"><button class="go" onclick="sendOrder()">Send order on Messenger</button></div>
    <div class="row"><button onclick="copyOrder()">Copy order</button><button onclick="order={};saveOrder();render();drawBar();closeSheet()">Clear</button></div>
    <p class="note">Messenger opens with your order typed in. If the message box is empty, paste — your order is already copied.</p></div>`,'Your order'); };
window.qty=(id,d)=>{ const i=items.find(x=>x.id===id); let n=(order[id]||0)+d; if(i&&i.stock>0&&!i.pre) n=Math.min(n,i.stock); if(n<=0) delete order[id]; else order[id]=n; saveOrder(); render(); drawBar(); openOrder(); };
window.copyOrder=async()=>{ try{ await navigator.clipboard.writeText(orderText()); toast('Order copied'); }catch(e){ prompt('Copy your order',orderText()); } };
window.sendOrder=async()=>{ const t=orderText(); try{ await navigator.clipboard.writeText(t); }catch(e){} const l=msgLink(t); if(l) window.open(l,'_blank','noopener'); else toast('This shop has no Messenger link yet. Your order is copied.'); };
let tt=null; function toast(s){ let el=document.querySelector('.toast'); if(!el){ el=document.createElement('div'); el.className='toast'; el.setAttribute('role','status'); document.body.appendChild(el); } el.textContent=s; clearTimeout(tt); tt=setTimeout(()=>el.remove(),2200); }
load();
