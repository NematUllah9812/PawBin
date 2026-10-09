(function(){
  'use strict';
  var $=function(s,c){return (c||document).querySelector(s)};
  var $$=function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s))};
  var money=function(p){return '£'+(p/100).toFixed(2)};
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PICKS=['dog-kong-classic','cat-feather-wand','dog-snuffle-mat','cat-circuit','dog-smart-ball','cat-tunnel','dog-brick-puzzle',
             'cat-laser-tower','dog-rope-tug','cat-catnip-bananas','dog-wobbler-ball','cat-window-perch','dog-frisbee','cat-kicker',
             'dog-lick-mat','cat-tower-tracks','dog-teething-set','cat-mouse-toy','dog-plush-tiger','cat-sisal-post','dog-plush-fox','cat-puzzle-feeder','dog-chuckit-launcher','cat-smart-ball'];
  /* Resolve the asset base at runtime: if the page is previewed from a parent
     path (e.g. /pawbin/), the fallback handler rewrites srcs — mirror that here. */
  var base=null;
  function assetBase(){
    if(base) return base;
    var best='assets/';
    for(var i=0;i<document.images.length;i++){
      var im=document.images[i], s=im.getAttribute('src')||'';
      var m=s.match(/^(.*?)assets\/(img|icons)\//);
      if(m && im.naturalWidth>0){ best=m[1]+'assets/'; break; }
    }
    base=best; return base;
  }
  var imgPath=function(slug){return assetBase()+'icons/'+slug+'.jpg'};

  /* ---------- toast ---------- */
  var toastEl=$('#toast'), toastT;
  function toast(msg){
    toastEl.textContent=msg; toastEl.dataset.show='true';
    clearTimeout(toastT); toastT=setTimeout(function(){toastEl.dataset.show='false'},2600);
  }

  /* ---------- header scroll ---------- */
  var header=$('#header');
  var onScroll=function(){header.dataset.scrolled=(window.scrollY>10)?'true':'false'};
  onScroll(); addEventListener('scroll',onScroll,{passive:true});

  /* ---------- back to top ---------- */
  var toTop=$('#toTop');
  var onScrollTop=function(){ toTop.dataset.show=(window.scrollY>600)?'true':'false'; };
  onScrollTop(); addEventListener('scroll',onScrollTop,{passive:true});
  toTop.addEventListener('click',function(){ window.scrollTo({top:0,behavior:reduce?'auto':'smooth'}); });

  /* ---------- mobile menu ---------- */
  var burger=$('#burger'), mm=$('#mobileMenu');
  burger.addEventListener('click',function(){
    var open=burger.getAttribute('aria-expanded')==='true';
    burger.setAttribute('aria-expanded',String(!open));
    burger.setAttribute('aria-label',open?'Open menu':'Close menu');
    mm.dataset.open=String(!open);
  });
  $$('#mobileMenu a').forEach(function(a){a.addEventListener('click',function(){
    burger.setAttribute('aria-expanded','false'); mm.dataset.open='false';
  })});

  /* ---------- hero slot machine ---------- */
  $$('.slot').forEach(function(slot,idx){
    var pool=PICKS.slice(), current=0, layers=[0,1].map(function(i){
      var im=document.createElement('img');
      im.src=imgPath(pool[(idx*3+i)%pool.length]);
      im.alt=''; im.setAttribute('draggable','false');
      slot.appendChild(im); return im;
    });
    var active=0; layers[0].classList.add('on'); current=(idx*3)%pool.length;
    function advance(){
      var next=layers[active^1];
      current=(current+1)%pool.length;
      next.src=imgPath(pool[current]);
      next.classList.add('on'); layers[active].classList.remove('on'); active^=1;
    }
    slot._advance=advance;
    if(!reduce){ setInterval(advance, 2500+idx*420); }
    slot.addEventListener('click',advance);
    slot.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){e.preventDefault();advance();} });
  });

  /* ---------- tabs ---------- */
  var tabs=$$('.tab');
  function selectTab(btn){
    tabs.forEach(function(t){
      var on=(t===btn);
      t.setAttribute('aria-selected',String(on));
      var panel=document.getElementById(t.getAttribute('aria-controls'));
      if(panel) panel.hidden=!on;
    });
  }
  tabs.forEach(function(t){ t.addEventListener('click',function(){selectTab(t)}) });
  // keyboard support for the tablist (arrow keys, Home, End)
  var tablistEl=document.querySelector('.tabs');
  if(tablistEl){ tablistEl.addEventListener('keydown',function(e){
    if(e.key!=='ArrowRight'&&e.key!=='ArrowLeft'&&e.key!=='Home'&&e.key!=='End')return;
    var i=tabs.indexOf(document.activeElement); if(i<0)return;
    e.preventDefault();
    var n=e.key==='Home'?tabs[0]:e.key==='End'?tabs[tabs.length-1]:tabs[(i+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length];
    n.focus(); selectTab(n);
  }); }
  // deep links like #cats / #bundles open the right tab, then scroll to the panel
  function openFromHash(){
    var h=(location.hash||'').replace('#','');
    if(!h)return;
    var map={cats:'tab-cats',dogs:'tab-dogs',bundles:'tab-bundles','panel-new':'tab-new'};
    if(map[h]){
      var btn=document.getElementById(map[h]);
      if(btn){
        selectTab(btn);
        var panel=document.getElementById(btn.getAttribute('aria-controls'));
        if(panel){ requestAnimationFrame(function(){ panel.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'}); }); }
      }
    }
  }
  openFromHash(); addEventListener('hashchange',openFromHash);

  /* ---------- cart ---------- */
  var KEY='pawbin_cart_v1', cart=[];
  try{ cart=JSON.parse(localStorage.getItem(KEY)||'[]')||[] }catch(e){ cart=[] }
  var drawer=$('#drawer'), scrim=$('#scrim'), cartBtn=$('#cartBtn');
  function save(){ try{localStorage.setItem(KEY,JSON.stringify(cart))}catch(e){} }
  function count(){ return cart.reduce(function(n,i){return n+i.q},0) }
  function total(){ return cart.reduce(function(n,i){return n+i.q*i.p},0) }
  function openDrawer(open){
    drawer.dataset.open=String(open); scrim.dataset.open=String(open);
    drawer.setAttribute('aria-hidden',String(!open));
    cartBtn.setAttribute('aria-expanded',String(open));
    document.body.style.overflow=open?'hidden':'';
    if(open){ $('#cartClose').focus(); }
    else if(drawer.contains(document.activeElement)){ cartBtn.focus(); }
  }
  function render(){
    var box=$('#cartItems'), t=total(), n=count();
    $('#cartCount').textContent=n; $('#cartCount').hidden=n===0;
    $('#cartTotal').textContent=money(t);
    var left=Math.max(0,2500-t);
    $('#shipBar').innerHTML = left>0
      ? 'Add <b>'+money(left)+'</b> for free tracked UK delivery<div class="bar"><i style="width:'+Math.min(100,t/2500*100)+'%"></i></div>'
      : '<b>Free tracked UK delivery</b> unlocked<div class="bar"><i style="width:100%"></i></div>';
    if(!cart.length){ box.innerHTML='<p class="empty">Your basket is empty. The shelf above is a good place to start.</p>'; return; }
    box.innerHTML=cart.map(function(i,ix){
      return '<div class="ci"><img src="'+imgPath(i.img)+'" alt="" loading="lazy" decoding="async">'+
        '<div><b>'+i.n+'</b><span>'+money(i.p)+' each</span>'+
        '<div class="qty"><button type="button" data-dec="'+ix+'" aria-label="Decrease quantity">−</button><span>'+i.q+'</span>'+
        '<button type="button" data-inc="'+ix+'" aria-label="Increase quantity">+</button></div>'+
        '<button class="rm" type="button" data-rm="'+ix+'">Remove</button></div>'+
        '<b style="font-size:14.5px">'+money(i.p*i.q)+'</b></div>';
    }).join('');
    $$('[data-inc]',box).forEach(function(b){b.onclick=function(){cart[+b.dataset.inc].q++;save();render()}});
    $$('[data-dec]',box).forEach(function(b){b.onclick=function(){var i=cart[+b.dataset.dec];i.q--;if(i.q<1)cart.splice(+b.dataset.dec,1);save();render()}});
    $$('[data-rm]',box).forEach(function(b){b.onclick=function(){cart.splice(+b.dataset.rm,1);save();render()}});
  }
  function add(slug,name,price,img){
    img=String(img).replace(/\.jpg$/,'');
    var found=cart.filter(function(i){return i.s===slug})[0];
    if(found){found.q++} else {cart.push({s:slug,n:name,p:price,img:img,q:1})}
    save(); render(); openDrawer(true); toast('Added to basket · '+name);
  }
  $$('[data-add]').forEach(function(btn){
    btn.addEventListener('click',function(){
      var card=btn.closest('[data-slug]');
      var slug=btn.dataset.slug||(card&&card.dataset.slug);
      var name=btn.dataset.name||(card&&card.dataset.name)||'Pawbin toy';
      var price=+(btn.dataset.price||(card&&card.dataset.price)||0);
      var img=btn.dataset.img||(card&&card.dataset.img)||'dog-kong-classic.jpg';
      add(slug,name,price,img);
    });
  });
  cartBtn.addEventListener('click',function(){openDrawer(true)});
  $('#cartClose').addEventListener('click',function(){openDrawer(false)});
  scrim.addEventListener('click',function(){openDrawer(false)});
  addEventListener('keydown',function(e){ if(e.key==='Escape'){openDrawer(false); $('.cookie').dataset.show='false';} });
  $('#checkout').addEventListener('click',function(){
    if(!cart.length){ toast('Add something first — the snuffle mat is a safe bet.'); return; }
    toast('Demo checkout — this storefront does not take payments.');
  });
  render();

  /* ---------- newsletter ---------- */
  var form=$('#newsForm');
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var v=$('#newsEmail').value.trim();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v)){ toast('That email looks off — mind checking it?'); $('#newsEmail').focus(); return; }
    $('#newsCard').dataset.done='true'; toast('Welcome to the Friday drop');
  });

  /* ---------- guides: full copy ships with the newsletter ---------- */
  $$('.guide-cta').forEach(function(b){ b.addEventListener('click',function(){
    toast('The full guide ships with the Friday drop');
    var nc=$('#newsCard'); if(nc) nc.scrollIntoView({behavior:reduce?'auto':'smooth',block:'center'});
    setTimeout(function(){ var em=$('#newsEmail'); if(em && em.offsetParent!==null) em.focus({preventScroll:true}); }, reduce?50:700);
  }); });

  /* ---------- cookie banner ---------- */
  var cookie=$('#cookie'), CKEY='pawbin_cookies';
  if(!localStorage.getItem(CKEY)){
    setTimeout(function(){cookie.dataset.show='true'},1400);
  }
  function closeCookies(v){ try{localStorage.setItem(CKEY,v)}catch(e){} cookie.dataset.show='false'; }
  $('#cookieAccept').addEventListener('click',function(){closeCookies('accept')});
  $('#cookieDeny').addEventListener('click',function(){closeCookies('deny')});
  var cookieLink=$('#cookieLink');
  if(cookieLink){ cookieLink.addEventListener('click',function(){ try{localStorage.removeItem(CKEY)}catch(e){} cookie.dataset.show='true'; }); }

  /* ---------- footer: letters rain toys ---------- */
  var word=document.getElementById('wordmark');
  if(word){
    word.addEventListener('click',function(e){
      var btn=e.target.closest('button'); if(!btn) return;
      var box=btn.getBoundingClientRect();
      var n=reduce?4:10;
      for(var i=0;i<n;i++){
        var im=document.createElement('img');
        var slug=PICKS[(Math.random()*PICKS.length)|0]; im.src=imgPath(slug); im.className='falling'; im.alt=''; im.dataset.f=slug+'.jpg';
        im.style.left=(box.left+Math.random()*box.width-18)+'px';
        im.style.top=(box.top-10)+'px';
        var dur=(1.1+Math.random()*1.5).toFixed(2);
        im.style.animation='fall '+dur+'s cubic-bezier(.35,.6,.5,1) forwards';
        im.style.animationDelay=(i*0.055).toFixed(2)+'s';
        im.style.setProperty('--rot',((Math.random()*720-360)|0)+'deg');
        document.body.appendChild(im);
        (function(node){ setTimeout(function(){node.remove()}, 3400); })(im);
      }
    });
  }

  /* ---------- reveal on scroll ---------- */
  var reveals=$$('.reveal');
  if(!('IntersectionObserver' in window) || reduce){ reveals.forEach(function(el){el.classList.add('in')}); }
  else{
    var io=new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); } });
    },{rootMargin:'0px 0px -8% 0px',threshold:0.08});
    reveals.forEach(function(el){io.observe(el)});
  }
})();
