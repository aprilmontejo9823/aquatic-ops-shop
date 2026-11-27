/* Aquatic Ops shop page — browser side. The page arrives already filled in (for search engines and speed);
   this script loads the live stock from the shop's app data and keeps the order list. */
(function(){
'use strict';
const A=window.AO, esc=A.esc, $=id=>document.getElementById(id), B=document.body, FB=A.FB;
const PAGE=B.dataset.page||'shop';
const SHOP=(B.dataset.shop||new URLSearchParams(location.search).get('s')||'').toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,30);
let PRE={}; try{ PRE=JSON.parse(($('pre')||{}).textContent||'{}')||{}; }catch(e){}
const BASE=PRE.base||'';
let shop=PRE.shop||null, items=PRE.items||[], filt='all', cat='', q='', live=false;
let order={}; try{ order=JSON.parse(sessionStorage.getItem('ao_order_'+SHOP)||'{}')||{}; }catch(e){}
const imgCache={};
const today=()=>new Date().toISOString().slice(0,10);

/* ---------- data ---------- */
const FIELDS=['name','size','cat','price','sale','stock','pre','eta','care','since','updated'];
async function getShop(){
  const r=await fetch(`${FB.base}/shops/${SHOP}?key=${FB.key}`);
  if(r.status===404) return null; if(!r.ok) throw new Error(r.status);
  return A.obj((await r.json()).fields||{});
}
async function getItems(){
  const mask=FIELDS.map(f=>'mask.fieldPaths='+f).join('&'); let page='', all=[];
  do{ const r=await fetch(`${FB.base}/shops/${SHOP}/items?pageSize=300&${mask}&key=${FB.key}${page?'&pageToken='+page:''}`); if(!r.ok) throw new Error(r.status);
    const d=await r.json(); (d.documents||[]).forEach(doc=>all.push({id:doc.name.split('/').pop(),...A.obj(doc.fields||{})})); page=d.nextPageToken||''; }while(page);
  return all.filter(i=>i.name&&/^[\w-]{1,40}$/.test(i.id));
}
const isOpen=s=>s&&s.active===true&&!(s.until&&s.until<today());

/* ---------- pictures: files made for search engines when current, otherwise straight from the shop's data ---------- */
function imgOf(i){ const p=PRE.img&&PRE.img[i.id]; if(p&&p.u===i.updated) return p.f?BASE+p.f:''; return imgCache[i.id]!==undefined?imgCache[i.id]:null; }
const hrefOf=i=>PRE.pages&&PRE.pages[i.id]?BASE+'p/'+i.id+'/':'#i='+i.id;
let io=null, pend=[], tmr=null;
function lazyImages(){
  if(io) io.disconnect();
  const els=[...document.querySelectorAll('img[data-lazy]')]; if(!els.length) return;
  if(!('IntersectionObserver' in window)){ fetchImgs(els.map(e=>e.dataset.lazy)); return; }
  io=new IntersectionObserver(es=>{ const ids=es.filter(e=>e.isIntersecting).map(e=>{ io.unobserve(e.target); return e.target.querySelector('img[data-lazy]').dataset.lazy; }); if(ids.length) fetchImgs(ids); },{rootMargin:'400px'});
  els.forEach(im=>io.observe(im.parentElement));
}
function fetchImgs(ids){ pend.push(...ids); clearTimeout(tmr); tmr=setTimeout(async()=>{ const b=[...new Set(pend)].filter(id=>imgCache[id]===undefined); pend=[]; if(!b.length) return;
  for(let k=0;k<b.length;k+=20){ const part=b.slice(k,k+20);
    try{ const r=await fetch(`${FB.base}:batchGet?key=${FB.key}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documents:part.map(id=>FB.base.split('/v1/')[1]+'/shops/'+SHOP+'/items/'+id),mask:{fieldPaths:['img']}})});
      (await r.json()).forEach(x=>{ if(x.found){ const id=x.found.name.split('/').pop(), v=A.val((x.found.fields||{}).img); imgCache[id]=/^data:image\/(jpeg|webp|png);base64,/.test(v||'')?v:''; } });
    }catch(e){}
    part.forEach(id=>{ if(imgCache[id]===undefined) imgCache[id]=''; showImg(id); }); } },60); }
function showImg(id){ const src=imgCache[id]; document.querySelectorAll(`img[data-lazy="${id}"]`).forEach(im=>{ if(!src){ im.remove(); return; } im.src=src; im.hidden=false; im.removeAttribute('data-lazy'); const ph=im.parentElement.querySelector('.ph'); if(ph) ph.remove(); }); }

/* ---------- catalog ---------- */
function state(h,p,retry){
  if(PAGE==='item'){ const box=$('ipLive'); if(box) box.innerHTML=`<p class="stock out"><i></i>${esc(h)}</p>`; return; }
  $('tools').hidden=true; $('info').hidden=true;
  $('main').innerHTML=`<div class="state"><h2>${esc(h)}</h2><p>${p}</p>${retry?'<button class="add" type="button" data-reload>Reload</button>':''}</div>`;
}
function paintShop(){
  if(/^#[0-9a-f]{6}$/i.test(shop.color||'')) document.documentElement.style.setProperty('--accent',shop.color);
  if(PAGE==='item') return;
  if(!PRE.shop){ // page made for any shop (?s=): fill the top from the live data
    document.title=shop.name+(shop.tagline?' – '+shop.tagline:'');
    $('hero').querySelector('.hero-in').innerHTML=A.hero(shop,items,/^data:image\/(png|jpeg|webp);base64,/.test(shop.logo||'')?shop.logo:'',true);
    $('info').innerHTML=A.info(shop); $('info').hidden=!$('info').innerHTML;
  }
  const st=$('stats'); if(st) st.innerHTML=A.heroStats(items);
}
function renderChips(){ $('chips').innerHTML=A.chips(items,filt,cat); }
function render(){
  if(PAGE==='item') return;
  const f=A.FILTERS.find(x=>x[0]===filt)[2], now=Date.now();
  const L=A.sort(items.filter(i=>f(i)&&(!cat||i.cat===cat)&&(!q||(i.name+' '+(i.size||'')+' '+(i.cat||'')).toLowerCase().includes(q))),now);
  if(!L.length){ $('main').innerHTML=`<p class="empty">${items.length?'No items match. Try another word or filter.':'No items posted yet. Message the shop to ask what is available.'}</p>`; return; }
  const ctx={shop,now,img:imgOf,href:hrefOf,inOrder:id=>order[id]||0};
  $('main').innerHTML='<div class="grid">'+L.map(i=>A.card(i,ctx)).join('')+'</div>'; lazyImages();
}
function syncCards(){ // update only the order buttons (keeps scroll and images in place)
  document.querySelectorAll('[data-add]').forEach(b=>{ const id=b.dataset.add, n=order[id]||0, i=items.find(x=>x.id===id); if(!i) return;
    b.classList.toggle('in',!!n); b.textContent=n?'In your order ('+n+')':A.isPre(i)?'Add pre-order':'Add to order'; });
}

/* ---------- order list ---------- */
function saveOrder(){ try{ sessionStorage.setItem('ao_order_'+SHOP,JSON.stringify(order)); }catch(e){} }
function orderLines(){ return Object.entries(order).map(([id,n])=>({i:items.find(x=>x.id===id),n})).filter(x=>x.i); }
function drawBar(){ const L=orderLines(); $('bar').hidden=!L.length; if(!L.length) return;
  const n=L.reduce((a,x)=>a+x.n,0); $('barTot').textContent=A.peso(L.reduce((a,x)=>a+x.n*A.priceOf(x.i),0)); $('barN').textContent=n+(n===1?' item':' items')+' in your order'; }
function toggle(id){ if(order[id]) delete order[id]; else order[id]=1; saveOrder(); syncCards(); drawBar(); if(order[id]) toast('Added to your order'); }
const orderText=()=>A.orderText(shop,orderLines());

/* ---------- sheets ---------- */
let lastFocus=null;
function sheet(html,label){ lastFocus=document.activeElement;
  $('sheetHost').innerHTML=`<div class="dim" data-dim><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}">${html}</div></div>`; document.body.style.overflow='hidden';
  const f=$('sheetHost').querySelector('.x'); if(f) f.focus(); }
function closeSheet(){ if(!$('sheetHost').innerHTML) return; $('sheetHost').innerHTML=''; document.body.style.overflow='';
  if(/^#(i=|order)/.test(location.hash)) history.replaceState(null,'',location.pathname+location.search); if(lastFocus&&lastFocus.focus) lastFocus.focus(); }
function openItem(id){ const i=items.find(x=>x.id===id); if(!i) return; history.replaceState(null,'','#i='+id);
  const im=imgOf(i), page=PRE.pages&&PRE.pages[id]?BASE+'p/'+id+'/':'';
  sheet(`<div class="big"><button class="x" type="button" data-x aria-label="Close">✕</button>${im?`<img src="${esc(im)}" alt="${esc(A.alt(i))}">`:`<span class="ph">${A.FISH}</span>${im===null?`<img data-lazy="${esc(id)}" alt="${esc(A.alt(i))}" hidden>`:''}`}</div>
    <div class="pad"><h2>${esc(i.name)}</h2><p class="meta">${esc([i.size,i.cat].filter(Boolean).join(' · '))}</p>
    <div class="price${A.onSale(i)?' sale':''}">${A.peso(A.priceOf(i))}${A.onSale(i)?`<s>${A.peso(i.price)}</s>`:''}</div>${A.stockLine(i)}
    ${i.care?`<div class="care"><h3>Care and info</h3>${esc(i.care)}</div>`:''}
    <div class="row">${A.isOut(i)?`<a class="go" target="_blank" rel="noopener" href="${esc(A.msgLink(shop,'Hi! Kailan po babalik ang '+A.label(i)+'?'))}">Ask when it's back</a>`
      :`<button class="go" type="button" data-sheetadd="${esc(id)}">${order[id]?'Remove from order':A.isPre(i)?'Add pre-order':'Add to order'}</button>`}
    <button type="button" data-share="${esc(id)}">Share</button></div>${page?`<p class="note"><a href="${esc(page)}">Open the item page</a></p>`:''}</div>`, i.name);
  if(im===null) fetchImgs([id]); }
async function shareItem(id){ const i=items.find(x=>x.id===id); if(!i) return;
  const url=PRE.pages&&PRE.pages[id]?new URL(BASE+'p/'+id+'/',location.href).href:location.origin+location.pathname+location.search+'#i='+id, text=`${A.label(i)} – ${A.peso(A.priceOf(i))} at ${shop.name}`;
  if(navigator.share){ try{ await navigator.share({title:i.name,text,url}); return; }catch(e){ if(e.name==='AbortError') return; } }
  try{ await navigator.clipboard.writeText(url); toast('Link copied'); }catch(e){ prompt('Copy this link',url); } }
function openOrder(){ const L=orderLines(); if(!L.length){ closeSheet(); return; }
  if(PAGE==='item'){ location.href=BASE+'#order'; return; }
  history.replaceState(null,'','#order');
  sheet(`<div class="pad" style="padding-top:22px"><button class="x" type="button" data-x aria-label="Close">✕</button><h2>Your order</h2>
    <ul class="ol">${L.map(x=>`<li><div class="n">${esc(x.i.name)}<small>${esc(x.i.size?x.i.size+' · ':'')}${A.peso(A.priceOf(x.i))} each${A.isPre(x.i)?' · pre-order':''}</small></div>
      <div class="qty"><button type="button" data-qty="${x.i.id}" data-d="-1" aria-label="One less ${esc(x.i.name)}">−</button><span>${x.n}</span><button type="button" data-qty="${x.i.id}" data-d="1" aria-label="One more ${esc(x.i.name)}">+</button></div></li>`).join('')}</ul>
    <div class="price">${A.peso(L.reduce((a,x)=>a+x.n*A.priceOf(x.i),0))}</div>
    <div class="row"><button class="go" type="button" data-send>${A.MSGR.replace('<svg','<svg style="width:18px;height:18px;vertical-align:-3px;margin-right:6px"')}Send order on Messenger</button></div>
    <div class="row"><button type="button" data-copy>Copy order</button><button type="button" data-clear>Clear</button></div>
    <p class="note">Messenger opens with your order typed in. If the message box is empty, paste — your order is already copied.</p></div>`,'Your order'); }
function qty(id,d){ const i=items.find(x=>x.id===id); let n=(order[id]||0)+d; if(i&&i.stock>0&&!i.pre) n=Math.min(n,i.stock); if(n<=0) delete order[id]; else order[id]=n; saveOrder(); syncCards(); drawBar(); openOrder(); }
async function sendOrder(){ const t=orderText(); try{ await navigator.clipboard.writeText(t); }catch(e){} const l=A.msgLink(shop,t); if(l) window.open(l,'_blank','noopener'); else toast('This shop has no Messenger link yet. Your order is copied.'); }
let tt=null; function toast(s){ let el=document.querySelector('.toast'); if(!el){ el=document.createElement('div'); el.className='toast'; el.setAttribute('role','status'); document.body.appendChild(el); } el.textContent=s; clearTimeout(tt); tt=setTimeout(()=>el.remove(),2200); }

/* ---------- clicks ---------- */
document.addEventListener('click',e=>{
  const t=e.target, c=s=>t.closest(s);
  let el;
  if(c('[data-reload]')) return location.reload();
  if((el=c('[data-add]'))) return toggle(el.dataset.add);
  if((el=c('[data-open]'))&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&live){ e.preventDefault(); return openItem(el.dataset.open); }
  if((el=c('[data-f]'))){ filt=el.dataset.f; renderChips(); return render(); }
  if((el=c('[data-c]'))){ cat=cat===el.dataset.c?'':el.dataset.c; renderChips(); return render(); }
  if(c('[data-x]')||t.matches('[data-dim]')) return closeSheet();
  if((el=c('[data-sheetadd]'))){ toggle(el.dataset.sheetadd); return openItem(el.dataset.sheetadd); }
  if((el=c('[data-share]'))) return shareItem(el.dataset.share);
  if((el=c('[data-qty]'))) return qty(el.dataset.qty,+el.dataset.d);
  if(c('[data-send]')) return sendOrder();
  if(c('[data-copy]')) return (async()=>{ try{ await navigator.clipboard.writeText(orderText()); toast('Order copied'); }catch(e){ prompt('Copy your order',orderText()); } })();
  if(c('[data-clear]')){ order={}; saveOrder(); syncCards(); drawBar(); return closeSheet(); }
});
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeSheet(); });
$('barGo').onclick=openOrder;
const qi=$('q'); if(qi) qi.addEventListener('input',e=>{ q=e.target.value.trim().toLowerCase(); render(); });

/* ---------- start ---------- */
async function start(){
  if(PAGE==='root'&&SHOP&&(PRE.shops||[]).some(s=>s.id===SHOP)){ location.replace(SHOP+'/'+location.hash); return; }
  if(!SHOP){ state('Find your shop',PRE.shops&&PRE.shops.length?PRE.shops.map(s=>`<a class="add" style="display:inline-block;margin:6px" href="${esc(s.id)}/">${esc(s.name)}</a>`).join(''):'Open the link the shop sent you.'); return; }
  if(shop&&items.length){ live=true; drawBar(); lazyImages(); }   // usable right away from the page itself
  let s, L;
  try{ s=await getShop(); }catch(e){ if(!shop) state('Could not load the shop','Check your internet connection, then reload the page.',true); return; }
  if(!s){ state('Shop not found','Check the link the shop sent you.'); return; }
  if(!isOpen(s)){ shop=s; state(s.name||'Shop page','This shop page is not open right now. Message the shop on Facebook.'); return; }
  try{ L=await getItems(); }catch(e){ if(!items.length) $('main').innerHTML='<p class="empty">Could not load the items. Check your internet connection, then reload the page.</p>'; return; }
  const changed=JSON.stringify(L)!==JSON.stringify(items)||!live;
  shop=s; items=L; live=true;
  Object.keys(order).forEach(id=>{ if(!items.find(i=>i.id===id)) delete order[id]; });
  paintShop();
  if(PAGE==='item') updateItemPage(); else if(changed){ renderChips(); render(); }
  drawBar();
  const m=/^#i=([\w-]+)/.exec(location.hash); if(m) openItem(m[1]); else if(location.hash==='#order') openOrder();
}
function updateItemPage(){ const id=B.dataset.item, i=items.find(x=>x.id===id), box=$('ipLive'); if(!box) return;
  if(!i){ box.innerHTML='<p class="stock out"><i></i>No longer listed</p>'; return; }
  box.innerHTML=`<div class="price${A.onSale(i)?' sale':''}">${A.peso(A.priceOf(i))}${A.onSale(i)?`<s>${A.peso(i.price)}</s>`:''}</div>${A.stockLine(i)}
    <div class="row">${A.isOut(i)?`<a class="go" target="_blank" rel="noopener" href="${esc(A.msgLink(shop,'Hi! Kailan po babalik ang '+A.label(i)+'?'))}">Ask when it's back</a>`
    :`<a class="go" target="_blank" rel="noopener" href="${esc(A.msgLink(shop,'Hi! Available pa po ba ang '+A.label(i)+' ('+A.peso(A.priceOf(i))+')?'))}">${A.MSGR.replace('<svg','<svg style="width:18px;height:18px;vertical-align:-3px;margin-right:6px"')}Order on Messenger</a><button class="add${order[id]?' in':''}" type="button" data-add="${esc(id)}" style="margin:0">${order[id]?'In your order ('+order[id]+')':'Add to order list'}</button>`}</div>`; }
start();
})();
