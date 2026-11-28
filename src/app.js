/* Aquatic Ops shop page — browser side. Pages arrive already filled in (for search engines and speed);
   this script loads the live stock from the shop's app data, and runs the item sheet and order list. */
(function(){
'use strict';
const A=window.AO, esc=A.esc, $=id=>document.getElementById(id), B=document.body, FB=A.FB;
const qs=new URLSearchParams(location.search);
const PAGE=B.dataset.page||'home';
const SHOP=(B.dataset.shop||qs.get('s')||'').toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,30);
let PRE={}; try{ PRE=JSON.parse(($('pre')||{}).textContent||'{}')||{}; }catch(e){}
const FOLDER=!!PRE.folder, BASE=PRE.base||'';
let shop=PRE.shop||null, items=PRE.items||[], gal=PRE.gal||[], filt='all', sub='', q='', live=false, mapq=PRE.mapq||'';
let CAT=B.dataset.cat||(qs.get('c')||'').replace(/[^a-z0-9-]/g,'');
let order={}; try{ order=JSON.parse(sessionStorage.getItem('ao_order_'+SHOP)||'{}')||{}; }catch(e){}
const imgCache={};
const today=()=>new Date().toISOString().slice(0,10);

/* ---------- data ---------- */
const FIELDS=['name','size','cat','sub','price','sale','stock','pre','eta','care','since','updated'];
const okId=id=>/^[\w-]{1,40}$/.test(id);
async function getShop(){ const r=await fetch(`${FB.base}/shops/${SHOP}?key=${FB.key}`); if(r.status===404) return null; if(!r.ok) throw new Error(r.status); return A.obj((await r.json()).fields||{}); }
async function list(col,mask){ let page='', all=[];
  do{ const r=await fetch(`${FB.base}/shops/${SHOP}/${col}?pageSize=300${mask?'&'+mask.map(f=>'mask.fieldPaths='+f).join('&'):''}&key=${FB.key}${page?'&pageToken='+page:''}`); if(!r.ok) throw new Error(r.status);
    const d=await r.json(); (d.documents||[]).forEach(doc=>all.push({id:doc.name.split('/').pop(),...A.obj(doc.fields||{})})); page=d.nextPageToken||''; }while(page);
  return all.filter(x=>okId(x.id)); }
const getItems=async()=>(await list('items',FIELDS)).filter(i=>i.name);
const getGallery=async()=>(await list('gallery')).filter(g=>/^data:image\/(jpeg|webp|png);base64,/.test(g.img||'')).sort((a,b)=>(a.ord||0)-(b.ord||0)).map(g=>({src:g.img,cap:g.cap||''}));
const isOpen=s=>s&&s.active===true&&!(s.until&&s.until<today());

/* ---------- links and pictures ---------- */
const catHref=s=>FOLDER?BASE+'c/'+s+'/':'?s='+SHOP+'&c='+s;
const homeHref=()=>FOLDER?(BASE||'./'):'?s='+SHOP;
function imgOf(i){ const p=PRE.img&&PRE.img[i.id]; if(p&&p.u===i.updated) return p.f?BASE+p.f:''; return imgCache[i.id]!==undefined?imgCache[i.id]:null; }
const hrefOf=i=>FOLDER&&PRE.pages&&PRE.pages[i.id]?BASE+'p/'+i.id+'/':'#i='+i.id;
const absOf=i=>FOLDER&&PRE.site&&PRE.pages&&PRE.pages[i.id]?PRE.site+'p/'+i.id+'/':location.origin+location.pathname+location.search+'#i='+i.id;
const ctx=()=>({shop,now:Date.now(),img:imgOf,href:hrefOf,abs:absOf,inOrder:id=>order[id]||0,catHref,home:homeHref()});
const ask=()=>A.askMode(shop,items);
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

/* ---------- drawing ---------- */
function state(h,p,retry){
  if(PAGE==='item'){ const box=$('ipLive'); if(box) box.innerHTML=`<p class="stock out"><i></i>${esc(h)}</p>`; return; }
  $('nav').innerHTML=''; $('foot').innerHTML='';
  $('content').innerHTML=`<div class="wrap state"><h2>${esc(h)}</h2><p>${p}</p>${retry?'<button class="add" type="button" data-reload>Reload</button>':''}</div>`;
}
const catOf=()=>A.cats(items).find(c=>c.slug===CAT);
const catItems=()=>{ const c=catOf(); return c?items.filter(i=>(i.cat||'Items')===c.name):[]; };
function drawNav(){ $('nav').innerHTML=A.nav(A.cats(items),PAGE==='cat'?CAT:PAGE==='home'?'home':'',ctx()); }
function drawGrid(){ if(PAGE!=='cat') return; const L=catItems(); $('main').innerHTML=A.grid(L,filt,sub,q,ctx()); lazyImages(); }
function drawChips(){ const el=$('chips'); if(el) el.innerHTML=A.chips(catItems(),filt,sub); }
function drawAll(){ // pages made in the browser (shops without their own folder)
  const c=ctx(), cats=A.cats(items), logo=/^data:image\/(png|jpeg|webp);base64,/.test(shop.logo||'')?shop.logo:'';
  if(/^#[0-9a-f]{6}$/i.test(shop.color||'')) document.documentElement.style.setProperty('--accent',shop.color);
  mapq=A.mapQuery(shop);
  const cat=catOf(); if(CAT&&!cat) CAT='';
  document.title=cat?`${cat.name} – ${shop.name}`:shop.name+(shop.tagline?' – '+shop.tagline:'');
  $('top').innerHTML=A.hero(shop,items,{logo,photo:gal[0]&&gal[0].src,h1:!cat,slim:!!cat,home:c.home,cats,ctx:c,mapq});
  $('nav').innerHTML=A.nav(cats,cat?cat.slug:'home',c);
  $('content').innerHTML=cat?A.catPage(cat,catItems(),c):A.home(shop,items,gal,c,mapq);
  $('foot').innerHTML=A.foot(shop,cats,c); $('fab').innerHTML=A.fab(shop);
  lazyImages(); wireSearch();
}
function refreshHome(){ // front page made ahead of time: only the counts and new arrivals change
  drawNav(); const c=ctx(), cats=A.cats(items);
  const b=$('browse'); if(b) b.outerHTML=A.tiles(cats,items,c);
  const f=$('fresh'), s=A.strip(items,c); if(f) f.outerHTML=s||'<span id="fresh"></span>';
  lazyImages();
}
function syncCards(){ document.querySelectorAll('[data-add]').forEach(b=>{ const id=b.dataset.add, n=order[id]||0, i=items.find(x=>x.id===id); if(!i) return;
  b.classList.toggle('in',!!n); b.textContent=n?'In your order ('+n+')':PAGE==='item'?'Add to order list':A.isPre(i)?'Add pre-order':'Add to order'; }); }

/* ---------- order list (only when prices are shown) ---------- */
function saveOrder(){ try{ sessionStorage.setItem('ao_order_'+SHOP,JSON.stringify(order)); }catch(e){} }
function orderLines(){ return Object.entries(order).map(([id,n])=>({i:items.find(x=>x.id===id),n})).filter(x=>x.i&&A.hasPrice(x.i)); }
function drawBar(){ const L=shop&&!ask()?orderLines():[]; $('bar').hidden=!L.length; B.classList.toggle('has-bar',!!L.length); if(!L.length) return;
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
  const im=imgOf(i), page=FOLDER&&PRE.pages&&PRE.pages[id]?BASE+'p/'+id+'/':'', c=ctx();
  const act=A.hasPrice(i)&&A.avail(i)?`<button class="go" type="button" data-sheetadd="${esc(id)}">${order[id]?'Remove from order':A.isPre(i)?'Add pre-order':'Add to order'}</button>`:A.action(i,c,'go');
  sheet(`<div class="big"><button class="x" type="button" data-x aria-label="Close">✕</button>${im?`<img src="${esc(im)}" alt="${esc(A.alt(i))}">`:`<span class="ph">${A.FISH}</span>${im===null?`<img data-lazy="${esc(id)}" alt="${esc(A.alt(i))}" hidden>`:''}`}</div>
    <div class="pad"><h2>${esc(i.name)}</h2><p class="meta">${esc(A.meta(i))}</p>
    ${A.hasPrice(i)?`<div class="price${A.onSale(i)?' sale':''}">${A.peso(A.priceOf(i))}${A.onSale(i)?`<s>${A.peso(i.price)}</s>`:''}</div>`:''}${A.stockLine(i)}
    ${i.care?`<div class="care"><h3>Care and info</h3>${esc(i.care)}</div>`:''}
    <div class="row">${act}<button type="button" data-share="${esc(id)}">Share</button></div>${page?`<p class="note"><a href="${esc(page)}">Open the item page</a></p>`:''}</div>`, i.name);
  if(im===null) fetchImgs([id]); }
async function shareItem(id){ const i=items.find(x=>x.id===id); if(!i) return;
  const url=absOf(i), text=`${A.label(i)}${A.hasPrice(i)?' – '+A.peso(A.priceOf(i)):''} at ${shop.name}`;
  if(navigator.share){ try{ await navigator.share({title:i.name,text,url}); return; }catch(e){ if(e.name==='AbortError') return; } }
  try{ await navigator.clipboard.writeText(url); toast('Link copied'); }catch(e){ prompt('Copy this link',url); } }
function openOrder(){ const L=orderLines(); if(!L.length){ closeSheet(); return; }
  if(PAGE!=='cat'&&PAGE!=='home'&&PAGE!=='root'){ location.href=homeHref().replace(/#.*$/,'')+'#order'; return; }
  history.replaceState(null,'','#order');
  sheet(`<div class="pad" style="padding-top:22px"><button class="x" type="button" data-x aria-label="Close">✕</button><h2>Your order</h2>
    <ul class="ol">${L.map(x=>`<li><div class="n">${esc(x.i.name)}<small>${esc(x.i.size?x.i.size+' · ':'')}${A.peso(A.priceOf(x.i))} each${A.isPre(x.i)?' · pre-order':''}</small></div>
      <div class="qty"><button type="button" data-qty="${x.i.id}" data-d="-1" aria-label="One less ${esc(x.i.name)}">−</button><span>${x.n}</span><button type="button" data-qty="${x.i.id}" data-d="1" aria-label="One more ${esc(x.i.name)}">+</button></div></li>`).join('')}</ul>
    <div class="price">${A.peso(L.reduce((a,x)=>a+x.n*A.priceOf(x.i),0))}</div>
    <div class="row"><button class="go" type="button" data-send>${A.MSGR}<span>Send order on Messenger</span></button></div>
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
  if((el=c('[data-open]'))&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&live&&PAGE!=='item'){ e.preventDefault(); return openItem(el.dataset.open); }
  if((el=c('[data-f]'))){ filt=el.dataset.f; drawChips(); return drawGrid(); }
  if((el=c('[data-c]'))){ sub=sub===el.dataset.c?'':el.dataset.c; drawChips(); return drawGrid(); }
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
function wireSearch(){ const qi=$('q'); if(qi&&!qi.dataset.w){ qi.dataset.w=1; qi.addEventListener('input',e=>{ q=e.target.value.trim().toLowerCase(); drawGrid(); }); } }
wireSearch();
/* keep the active tab in view on small screens */
const onTab=document.querySelector('.tab.on'); if(onTab&&onTab.scrollIntoView) onTab.scrollIntoView({block:'nearest',inline:'center'});

/* ---------- start ---------- */
async function start(){
  if(PAGE==='root'&&SHOP&&(PRE.shops||[]).some(s=>s.id===SHOP)){ location.replace(SHOP+'/'+(CAT?'c/'+CAT+'/':'')+location.hash); return; }
  if(PAGE==='root'&&!SHOP){ state('Find your shop',PRE.shops&&PRE.shops.length?PRE.shops.map(s=>`<a class="add" style="display:inline-block;margin:6px" href="${esc(s.id)}/">${esc(s.name)}</a>`).join(''):'Open the link the shop sent you.'); return; }
  if(shop&&items.length){ live=true; drawBar(); lazyImages(); }   // usable right away from the page itself
  let s, L, g;
  try{ s=await getShop(); }catch(e){ if(!shop) state('Could not load the shop','Check your internet connection, then reload the page.',true); return; }
  if(!s){ state('Shop not found','Check the link the shop sent you.'); return; }
  if(!isOpen(s)){ shop=s; state(s.name||'Shop page','This shop page is not open right now. Message the shop on Facebook.'); return; }
  try{ L=await getItems(); if(PAGE==='root') g=await getGallery(); }catch(e){ if(!items.length) state('Could not load the items','Check your internet connection, then reload the page.',true); return; }
  const changed=JSON.stringify(L)!==JSON.stringify(items)||!live;
  shop=s; items=L; if(g) gal=g; live=true;
  Object.keys(order).forEach(id=>{ if(!items.find(i=>i.id===id)) delete order[id]; });
  if(/^#[0-9a-f]{6}$/i.test(shop.color||'')) document.documentElement.style.setProperty('--accent',shop.color);
  if(PAGE==='root') drawAll();
  else if(PAGE==='item') updateItemPage();
  else if(changed){ if(PAGE==='home') refreshHome(); else { drawNav(); drawChips(); drawGrid(); } }
  drawBar();
  const m=/^#i=([\w-]+)/.exec(location.hash); if(m) openItem(m[1]); else if(location.hash==='#order') openOrder();
}
function updateItemPage(){ const id=B.dataset.item, i=items.find(x=>x.id===id), box=$('ipLive'); if(!box) return;
  if(!i){ box.innerHTML='<p class="stock out"><i></i>No longer listed</p>'; return; }
  const c=ctx();
  box.innerHTML=`${A.hasPrice(i)?`<div class="price${A.onSale(i)?' sale':''}">${A.peso(A.priceOf(i))}${A.onSale(i)?`<s>${A.peso(i.price)}</s>`:''}</div>`:''}${A.stockLine(i)}
    <div class="row">${A.hasPrice(i)&&A.avail(i)?`<a class="go" target="_blank" rel="noopener" href="${esc(A.msgLink(shop,'Hi '+shop.name+'! Available pa po ba ang '+A.label(i)+' ('+A.peso(A.priceOf(i))+')?\n'+absOf(i)))}">${A.MSGR}<span>Order on Messenger</span></a><button class="add${order[id]?' in':''}" type="button" data-add="${esc(id)}" style="margin:0">${order[id]?'In your order ('+order[id]+')':'Add to order list'}</button>`
      :A.action(i,c,'go')}<button type="button" data-share="${esc(id)}">Share</button></div>`; }
start();
})();
