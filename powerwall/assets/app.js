/* ============================================================
   APP — Raycom Powerwall LP
   Attribution · tracking · countdown · form/booking · FAQ · UI
   ============================================================ */
(function(){
  "use strict";
  var C = window.CONFIG || {};

  /* ---------- helpers ---------- */
  function $(s,ctx){ return (ctx||document).querySelector(s); }
  function $$(s,ctx){ return Array.prototype.slice.call((ctx||document).querySelectorAll(s)); }
  function getParam(n){ return new URLSearchParams(location.search).get(n) || ""; }
  function genEventId(){ return 'lead_'+Date.now()+'_'+Math.random().toString(36).slice(2,9); }

  /* ---------- tracking dispatch (safe wrappers) ---------- */
  function fbq(){ if(window.fbq){ try{ window.fbq.apply(null,arguments);}catch(e){} } }
  function gtag(){ if(window.gtag){ try{ window.gtag.apply(null,arguments);}catch(e){} } }
  function dl(obj){ window.dataLayer=window.dataLayer||[]; window.dataLayer.push(obj); }

  function track(stdEvent, ga4Event, params, eventID){
    params = params||{};
    if(stdEvent){ eventID ? fbq('track',stdEvent,params,{eventID:eventID}) : fbq('track',stdEvent,params); }
    if(ga4Event){ gtag('event',ga4Event,params); }
    dl(Object.assign({event:ga4Event||stdEvent},params, eventID?{event_id:eventID}:{}));
  }

  /* ---------- attribution -> hidden fields ---------- */
  var ATTR = {
    utm_source:getParam('utm_source'), utm_medium:getParam('utm_medium'),
    utm_campaign:getParam('utm_campaign'), utm_term:getParam('utm_term'),
    utm_content:getParam('utm_content'),
    fbclid:getParam('fbclid'), gclid:getParam('gclid'),
    referrer:document.referrer||"", page_url:location.href
  };
  function fillAttribution(){
    Object.keys(ATTR).forEach(function(k){
      var el=document.querySelector('[name="'+k+'"]');
      if(el) el.value=ATTR[k];
    });
  }

  /* ---------- countdown ---------- */
  function initCountdown(){
    var deadline=new Date(C.PROMO_DEADLINE||'2026-06-30T23:59:59-04:00').getTime();
    var d=$('#cdD'),h=$('#cdH'),m=$('#cdM'),s=$('#cdS');
    if(!d) return;
    function tick(){
      var diff=deadline-Date.now();
      if(diff<0) diff=0;
      var dd=Math.floor(diff/86400000);
      var hh=Math.floor(diff%86400000/3600000);
      var mm=Math.floor(diff%3600000/60000);
      var ss=Math.floor(diff%60000/1000);
      d.textContent=String(dd).padStart(2,'0');
      h.textContent=String(hh).padStart(2,'0');
      m.textContent=String(mm).padStart(2,'0');
      s.textContent=String(ss).padStart(2,'0');
    }
    tick(); setInterval(tick,1000);
  }

  /* ---------- reveal on scroll ---------- */
  function initReveal(){
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target);} });
    },{threshold:.12});
    $$('.reveal').forEach(function(el){ io.observe(el); });
  }

  /* ---------- phone click -> Contact ---------- */
  function initPhone(){
    $$('a[href^="tel:"]').forEach(function(a){
      a.addEventListener('click',function(){
        track('Contact','phone_call_click',{method:'phone'});
      });
    });
  }

  /* ---------- InitiateCheckout (calculator + form reached) ---------- */
  var icFired=false;
  function fireInitiateCheckout(source){
    if(icFired) return; icFired=true;
    track('InitiateCheckout','begin_checkout',{source:source||'calculator'});
  }
  function initCheckoutTriggers(){
    var calc=$('#calculateur');
    if(calc){
      var io=new IntersectionObserver(function(es){
        es.forEach(function(e){ if(e.isIntersecting){ fireInitiateCheckout('calculator'); io.disconnect(); } });
      },{threshold:.4});
      io.observe(calc);
    }
    var form=$('#rendezvous');
    if(form){
      var io2=new IntersectionObserver(function(es){
        es.forEach(function(e){ if(e.isIntersecting){ fireInitiateCheckout('form_reached'); io2.disconnect(); } });
      },{threshold:.3});
      io2.observe(form);
    }
  }

  /* ---------- smooth scroll helpers ---------- */
  function scrollToId(id){
    var el=document.getElementById(id);
    if(el){ var y=el.getBoundingClientRect().top+window.pageYOffset-80; window.scrollTo({top:y,behavior:'smooth'}); }
  }
  function initAnchors(){
    $$('[data-scroll]').forEach(function(el){
      el.addEventListener('click',function(e){ e.preventDefault(); scrollToId(el.getAttribute('data-scroll')); });
    });
  }

  /* ---------- form / booking toggle ---------- */
  function initChoice(){
    var btns=$$('.form-choice button');
    var formPane=$('#paneForm'), bookPane=$('#paneBook');
    btns.forEach(function(b){
      b.addEventListener('click',function(){
        btns.forEach(function(x){x.classList.remove('on');});
        b.classList.add('on');
        var mode=b.getAttribute('data-mode');
        if(mode==='book'){
          formPane.style.display='none'; bookPane.style.display='block';
          loadBookingEmbed();
        }else{
          formPane.style.display='block'; bookPane.style.display='none';
        }
      });
    });
  }

  var bookingLoaded=false;
  function loadBookingEmbed(){
    var host=$('#bookingHost');
    if(!host) return;
    var url=C.GHL_CALENDAR_URL||"";
    if(bookingLoaded) return;
    bookingLoaded=true;
    if(url && url.indexOf('REMPLACER')===-1){
      // attach attribution to the calendar URL so GHL captures it
      var glue=url.indexOf('?')===-1?'?':'&';
      var qs=Object.keys(ATTR).filter(function(k){return ATTR[k];}).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(ATTR[k]);}).join('&');
      var full=url+(qs?glue+qs:'');
      var fid=(url.split('/').pop()||'ghlcal').split('?')[0];
      host.innerHTML='<iframe src="'+full+'" id="'+fid+'_widget" title="Réserver un appel-conseil" style="width:100%;border:none;overflow:hidden;" scrolling="no"></iframe>';
      // official LeadConnector embed script (resize + booking messages)
      if(!document.getElementById('ghl-form-embed')){
        var sc=document.createElement('script');
        sc.id='ghl-form-embed'; sc.type='text/javascript';
        sc.src='https://link.msgsndr.com/js/form_embed.js'; sc.async=true;
        document.body.appendChild(sc);
      }
      // GHL posts a message when a booking is confirmed
      window.addEventListener('message',function(ev){
        var d=ev.data;
        var isBooked = (typeof d==='string' && /appointment|booked|scheduled/i.test(d)) ||
                       (d && (d.type==='appointment_booked' || d.event==='appointment_booked' || d.booked));
        if(isBooked){ onBookingConfirmed(); }
      });
    }else{
      host.innerHTML='<div class="booking-ph">'+
        '<div class="cal-ic"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4.5" width="18" height="17" rx="2"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/><path d="M8.5 14l2.2 2.2L15.5 12" stroke-linecap="round" stroke-linejoin="round"/></svg></div>'+
        '<div style="color:var(--ivory);font-family:Marcellus,serif;font-size:21px">Calendrier de réservation</div>'+
        '<p style="max-width:34ch">Le calendrier GHL s\u2019affichera ici. Renseignez <b>CONFIG.GHL_CALENDAR_URL</b> pour activer la prise de rendez-vous en direct.</p>'+
        '<button class="cta" id="simBook" style="margin-top:6px">Simuler une réservation confirmée</button>'+
        '</div>';
      var sim=$('#simBook');
      if(sim) sim.addEventListener('click',onBookingConfirmed);
    }
  }

  function onBookingConfirmed(){
    var eventID=genEventId();
    // Le calendrier GHL crée le contact et le place en « Contact établi / RV Planifié » (étape Ventes).
    // Côté page : on ne déclenche QUE les signaux Pixel/GA (pas de POST /lead pour éviter un doublon).
    track('Lead','generate_lead',{lead_type:'appointment_booked',pipeline_stage:'Contact établi / RV Planifié',value:0,currency:'CAD'},eventID);
    track(null,'schedule',{lead_type:'appointment_booked'});
    showSuccess('booked');
  }

  /* ---------- CRM webhook (POST JSON complet au Worker) ---------- */
  function sendToCRM(payload){
    var url=C.WEBHOOK_URL||"";
    if(!url || url.indexOf('REMPLACER')!==-1){
      console.log('[Raycom] WEBHOOK_URL non configurée — payload qui SERAIT envoyé:',payload);
      return Promise.resolve();
    }
    return fetch(url,{
      method:'POST',
      headers:{'Content-Type':'application/json; charset=utf-8'},
      body:JSON.stringify(payload),
      keepalive:true
    }).catch(function(err){ console.warn('[Raycom] webhook error',err); });
  }

  function e164(p){ var d=String(p||'').replace(/\D/g,''); if(d.length===10) return '+1'+d; if(d.length===11&&d.charAt(0)==='1') return '+'+d; return d?('+'+d):''; }

  /* ---------- form validation + submit ---------- */
  function initForm(){
    var form=$('#leadForm');
    if(!form) return;
    fillAttribution();

    var required=['firstName','lastName','phone','email','address1','city','postalCode','property','interest','timeline','consent'];

    function validate(){
      var ok=true;
      required.forEach(function(name){
        var el=form.querySelector('[name="'+name+'"]');
        if(!el) return;
        var field=el.closest('.field')||el.closest('.consent');
        var valid=true;
        if(el.type==='checkbox') valid=el.checked;
        else valid=String(el.value).trim().length>0;
        if(name==='email' && valid) valid=/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.value);
        if(name==='phone' && valid) valid=(el.value.replace(/\D/g,'').length>=10);
        if(field) field.classList.toggle('invalid',!valid);
        if(!valid) ok=false;
      });
      return ok;
    }

    form.addEventListener('submit',function(e){
      e.preventDefault();
      if(!validate()){
        var firstErr=form.querySelector('.invalid');
        if(firstErr){ var y=firstErr.getBoundingClientRect().top+window.pageYOffset-110; window.scrollTo({top:y,behavior:'smooth'}); }
        return;
      }
      var btn=$('#submitBtn');
      if(btn){ btn.disabled=true; btn.dataset.label=btn.textContent; btn.textContent='Envoi en cours…'; }

      var eventID=genEventId();
      var fd=new FormData(form);
      var g=function(n){ var v=fd.get(n); return v==null?'':String(v).trim(); };
      var calc={}; try{ calc=JSON.parse(($('#field_calc')||{}).value||'{}'); }catch(e){}
      var consUnit=g('consumption_unit')||'$';
      var consRaw= consUnit==='kWh' ? (g('consumption_kwh')||g('consumption')) : g('consumption');
      var consNum=parseFloat(String(consRaw).replace(/[^\d.]/g,''))||0;
      var elig=g('eligibility');

      // Pixel navigateur avec eventID — le Worker enverra la CAPI serveur avec le MÊME id (dédup)
      track('Lead','generate_lead',{
        lead_type:'form_submission',
        pipeline_stage:'Nouveau lead',
        content_name:'Évaluation Powerwall',
        value:0,currency:'CAD'
      },eventID);

      var payload={
        firstName:g('firstName'), lastName:g('lastName'),
        email:g('email'), phone:e164(g('phone')),
        address1:g('address1'), city:g('city'), postalCode:g('postalCode').toUpperCase(), state:'Quebec',
        customFields:{
          type_de_propriete:g('property'),
          consommation_annuelle:consNum,
          unite_de_consommation:consUnit,
          interet:g('interest'),
          echeancier:g('timeline'),
          meilleur_moment_pour_un_appel:g('best_time')
        },
        consent:true,
        utm_source:ATTR.utm_source, utm_medium:ATTR.utm_medium, utm_campaign:ATTR.utm_campaign,
        utm_term:ATTR.utm_term, utm_content:ATTR.utm_content,
        fbclid:ATTR.fbclid, gclid:ATTR.gclid, referrer:ATTR.referrer, page_url:ATTR.page_url,
        event_id:eventID,
        lead_type:'form_submission', pipeline:'Ventes', pipeline_stage:'Nouveau lead',
        source:'landing-powerwall', submitted_at:new Date().toISOString(),
        calculator:calc, calculator_summary:($('#field_calc_summary')||{}).value||'',
        eligibility:elig
      };

      sendToCRM(payload).then(function(){
        showSuccess('form');
      });
    });
  }

  function showSuccess(kind){
    var card=$('#formCard'), success=$('#formSuccess');
    if(success){
      var h=$('#successTitle'), p=$('#successMsg');
      if(kind==='booked'){
        if(h) h.textContent='Votre appel-conseil est réservé.';
        if(p) p.textContent='Vous recevrez une confirmation par courriel. Jean-François vous appellera à l’heure choisie pour bâtir votre plan personnalisé. À très bientôt.';
      }else{
        if(h) h.textContent='Merci — votre demande est reçue.';
        if(p) p.textContent='Un membre de l’équipe Raycom vous contactera sous peu pour planifier votre appel-conseil gratuit et préparer votre évaluation.';
      }
    }
    if(card) card.style.display='none';
    var choice=$('.form-choice'); if(choice) choice.style.display='none';
    if(success){ success.classList.add('show'); var y=success.getBoundingClientRect().top+window.pageYOffset-120; window.scrollTo({top:y,behavior:'smooth'}); }
  }

  /* ---------- FAQ ---------- */
  function initFAQ(){
    $$('.faq-item').forEach(function(item){
      var q=$('.faq-q',item), a=$('.faq-a',item);
      q.addEventListener('click',function(){
        var open=item.classList.contains('open');
        $$('.faq-item').forEach(function(o){ o.classList.remove('open'); var oa=$('.faq-a',o); if(oa) oa.style.maxHeight=null; });
        if(!open){ item.classList.add('open'); a.style.maxHeight=a.scrollHeight+'px'; }
      });
    });
  }

  /* ---------- cookie banner ---------- */
  function initCookies(){
    var bar=$('#cookieBar');
    if(!bar) return;
    if(localStorage.getItem('raycom_consent')){ return; }
    setTimeout(function(){ bar.classList.add('show'); },1200);
    $('#cookieAccept').addEventListener('click',function(){
      localStorage.setItem('raycom_consent','granted');
      gtag('consent','update',{ad_storage:'granted',analytics_storage:'granted',ad_user_data:'granted',ad_personalization:'granted'});
      bar.classList.remove('show');
    });
    $('#cookieDecline').addEventListener('click',function(){
      localStorage.setItem('raycom_consent','denied');
      bar.classList.remove('show');
    });
  }

  /* ---------- calculator -> form CTA ---------- */
  function initCalcCTA(){
    var btn=$('#calcToForm');
    if(btn) btn.addEventListener('click',function(){
      fireInitiateCheckout('calculator_cta');
      scrollToId('rendezvous');
    });
  }

  /* ---------- partner logos from CONFIG ---------- */
  function initPartners(){
    $$('#partnerLogos .plogo[data-logo]').forEach(function(sp){
      var key=sp.getAttribute('data-logo');
      var url=C[key]||"";
      var img=sp.querySelector('img'), wm=sp.querySelector('.wm');
      if(url && url.indexOf('REMPLACER')===-1){ img.src=url; }
      else { if(img) img.style.display='none'; if(wm) wm.style.display='flex'; }
    });
  }

  /* ---------- consumption $/kWh toggle ---------- */
  function initConsumption(){
    var toggle=$('#consUnitToggle'), input=$('#field_consumption');
    if(!toggle||!input) return;
    var rate=C.HQ_RATE||0.085;
    var unit='$';
    function num(){ return parseFloat((input.value||'').replace(/[^\d.,]/g,'').replace(',','.'))||0; }
    function fmt(n){ return Math.round(n).toLocaleString('fr-CA'); }
    function recompute(){
      var v=num();
      var unitField=$('#field_consumption_unit'), kwhField=$('#field_consumption_kwh'), hint=$('#consConvHint');
      if(unitField) unitField.value=unit;
      if(v<=0){ if(hint) hint.textContent=''; if(kwhField) kwhField.value=''; return; }
      if(unit==='$'){
        var kwh=v/rate;
        if(kwhField) kwhField.value=Math.round(kwh);
        if(hint) hint.textContent='≈ '+fmt(kwh)+' kWh / an  (tarif '+String(rate).replace('.',',')+' $/kWh)';
      }else{
        var dollars=v*rate;
        if(kwhField) kwhField.value=Math.round(v);
        if(hint) hint.textContent='≈ '+fmt(dollars)+' $ / an  (tarif '+String(rate).replace('.',',')+' $/kWh)';
      }
    }
    toggle.querySelectorAll('button').forEach(function(b){
      b.addEventListener('click',function(){
        toggle.querySelectorAll('button').forEach(function(x){x.classList.remove('on');});
        b.classList.add('on');
        unit=b.getAttribute('data-u');
        input.placeholder = unit==='$' ? 'ex. 2 400 $ / an' : 'ex. 28 000 kWh / an';
        recompute();
      });
    });
    input.addEventListener('input',recompute);
  }

  /* ---------- sticky mobile CTA ---------- */
  function initMobileCta(){
    var bar=$('#mobileCta'), form=$('#rendezvous'), hero=$('#hero');
    if(!bar) return;
    var formIn=false;
    if(form){
      new IntersectionObserver(function(es){ es.forEach(function(e){ formIn=e.isIntersecting; sync(); }); },{threshold:.15}).observe(form);
    }
    function sync(){
      var past = window.pageYOffset > (hero?hero.offsetHeight*0.7:600);
      bar.classList.toggle('show', past && !formIn);
    }
    window.addEventListener('scroll',sync,{passive:true});
    sync();
  }

  /* ---------- urgency days mirror ---------- */
  function initUrgency(){
    var el=$('#urgencyDays'); if(!el) return;
    var deadline=new Date(C.PROMO_DEADLINE||'2026-06-30T23:59:59-04:00').getTime();
    var dd=Math.max(0,Math.floor((deadline-Date.now())/86400000));
    el.textContent=dd;
  }

  /* ---------- promo message rotator (lisible : fondu, pas de défilement) ---------- */
  function initPromoRotator(){
    var msg=$('#promoMsg'); if(!msg) return;
    var slides=$$('.promo-slide',msg);
    if(slides.length<2) return;
    var i=0;
    setInterval(function(){
      slides[i].classList.remove('is-active');
      i=(i+1)%slides.length;
      slides[i].classList.add('is-active');
    },4800);
  }

  /* ---------- sticky head shrink on scroll ---------- */
  function initStickyShrink(){
    var head=$('#stickyHead');
    if(!head) return;
    function sync(){ head.classList.toggle('scrolled', window.pageYOffset>30); }
    window.addEventListener('scroll',sync,{passive:true});
    sync();
  }

  /* ---------- ambient sound (WebAudio, off by default) ---------- */
  function initSound(){
    var btn=$('#soundToggle'); if(!btn) return;
    var ctx,master,lfo,nodes=[],on=false;
    function build(){
      var AC=window.AudioContext||window.webkitAudioContext;
      if(!AC) return false;
      ctx=new AC();
      master=ctx.createGain(); master.gain.value=0; master.connect(ctx.destination);
      var filter=ctx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value=440; filter.Q.value=0.6; filter.connect(master);
      // soft layered drone — warm, calm, "energy hum"
      [55,110,164.81,220].forEach(function(f,i){
        var o=ctx.createOscillator(); o.type=i%2?'sine':'triangle'; o.frequency.value=f;
        var g=ctx.createGain(); g.gain.value=[0.5,0.32,0.16,0.10][i];
        o.connect(g); g.connect(filter); o.start(); nodes.push(o);
        if(i===0){ o.detune.value=-4; } if(i===1){ o.detune.value=5; }
      });
      // slow movement
      lfo=ctx.createOscillator(); lfo.frequency.value=0.07;
      var lg=ctx.createGain(); lg.gain.value=120;
      lfo.connect(lg); lg.connect(filter.frequency); lfo.start();
      return true;
    }
    btn.addEventListener('click',function(){
      if(!ctx){ if(!build()) return; }
      if(ctx.state==='suspended') ctx.resume();
      on=!on;
      var t=ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.linearRampToValueAtTime(on?0.05:0.0001, t+ (on?1.2:0.6));
      btn.classList.toggle('on',on);
      btn.setAttribute('aria-pressed',on);
      var lbl=$('#soundLabel'); if(lbl) lbl.textContent= on?'Ambiance ·':'Ambiance';
      var ic=$('#soundIcon'); if(ic) ic.innerHTML = on
        ? '<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M19 7a8 8 0 0 1 0 10"/>'
        : '<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M17 9l4 6M21 9l-4 6"/>';
    });
  }

  /* ---------- images depuis CONFIG (badge Tesla, etc.) ---------- */
  function initConfigImages(){
    $$('[data-config-img]').forEach(function(img){
      var key=img.getAttribute('data-config-img');
      var url=C[key]||"";
      if(url && url.indexOf('REMPLACER')===-1){ img.src=url; }
      else { img.style.display='none'; }
    });
  }

  /* ---------- hero background image (si fournie) ---------- */
  function initHeroImage(){
    var poster=$('.hero-poster');
    if(poster && C.HERO_IMAGE){
      poster.style.backgroundImage="linear-gradient(180deg,rgba(8,8,9,.2),rgba(8,8,9,.55)),url('"+C.HERO_IMAGE+"')";
      poster.style.backgroundSize="cover";
      poster.style.backgroundPosition="center right";
      poster.classList.add('has-photo');
    }
  }

  /* ---------- éclair 3D réaliste animé (injection SVG, IDs uniques) ---------- */
  function initBolt(){
    var pts="13,2 3,14 12,14 11,22 21,10 12,10";
    $$('[data-bolt]').forEach(function(el,i){
      el.innerHTML=
        '<svg viewBox="-4 -3 32 30">'+
          '<defs>'+
            '<linearGradient id="bf'+i+'" x1="0" y1="0" x2="1" y2="1">'+
              '<stop offset="0" stop-color="#eaf5ff"/>'+
              '<stop offset=".4" stop-color="#5aa6ff"/>'+
              '<stop offset="1" stop-color="#1450bf"/>'+
            '</linearGradient>'+
            '<linearGradient id="bd'+i+'" x1="0" y1="0" x2="1" y2="1">'+
              '<stop offset="0" stop-color="#0c2f7d"/>'+
              '<stop offset="1" stop-color="#03102f"/>'+
            '</linearGradient>'+
            '<radialGradient id="bh'+i+'" cx="50%" cy="45%" r="55%">'+
              '<stop offset="0" stop-color="#7cc0ff" stop-opacity=".9"/>'+
              '<stop offset="1" stop-color="#1f6bff" stop-opacity="0"/>'+
            '</radialGradient>'+
            '<filter id="bg'+i+'" x="-90%" y="-90%" width="280%" height="280%">'+
              '<feGaussianBlur stdDeviation="1.7"/>'+
            '</filter>'+
            '<filter id="bc'+i+'" x="-50%" y="-50%" width="200%" height="200%">'+
              '<feGaussianBlur stdDeviation=".5"/>'+
            '</filter>'+
          '</defs>'+
          '<ellipse class="b-halo" cx="12" cy="12" rx="13" ry="14" fill="url(#bh'+i+')"/>'+
          '<g class="b-glow" filter="url(#bg'+i+')"><polygon points="'+pts+'" fill="#4aa0ff"/></g>'+
          '<polygon points="'+pts+'" fill="url(#bd'+i+')" transform="translate(.9 1.05)"/>'+
          '<polygon points="'+pts+'" fill="url(#bf'+i+')" stroke="#bfe0ff" stroke-width=".4" stroke-linejoin="round"/>'+
          '<polygon class="b-core" points="'+pts+'" fill="#ffffff" filter="url(#bc'+i+')" transform="scale(.62)" transform-origin="12 12"/>'+
          '<polyline class="b-hi" points="13,2 3,14 12,14" fill="none" stroke="#f4faff" stroke-width="1" stroke-linejoin="round"/>'+
          '<polygon class="b-flash" points="'+pts+'" fill="#ffffff"/>'+
        '</svg>';
    });
  }

  /* ---------- app Tesla interactif (flux d'énergie animé par mode) ---------- */
  /* ---------- app Tesla : bascule des vraies captures (fondu, téléphone fixe) ---------- */
  function initAppTesla(){
    var screen=document.getElementById('teslaScreen'); if(!screen) return;
    var shots=$$('.app-shot',screen), tabs=$$('.app-tab');
    function show(k){
      shots.forEach(function(im){ im.classList.toggle('on', im.getAttribute('data-k')===String(k)); });
      tabs.forEach(function(t){ t.classList.toggle('on', t.getAttribute('data-k')===String(k)); });
    }
    tabs.forEach(function(tab){
      tab.addEventListener('click',function(){ show(tab.getAttribute('data-k')); });
    });
    show(0);
  }

  /* ---------- média fondateur (photo OU vidéo si fournie, sinon placeholder) ---------- */
  function initFounderMedia(){
    var box=$('#founderMedia'); if(!box) return;
    var ph=box.querySelector('.auth-ph');
    if(C.FOUNDER_VIDEO){
      var v=document.createElement('video');
      v.src=C.FOUNDER_VIDEO; v.poster=C.FOUNDER_IMAGE||''; v.controls=true; v.playsInline=true; v.preload='metadata';
      box.insertBefore(v, box.firstChild);
      if(ph) ph.style.display='none';
    } else if(C.FOUNDER_IMAGE){
      var im=document.createElement('img');
      im.src=C.FOUNDER_IMAGE; im.alt='Jean-François, maître électricien chez Raycom'; im.loading='lazy';
      im.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';
      box.insertBefore(im, box.firstChild);
      if(ph) ph.style.display='none';
    }
  }

  /* ---------- init ---------- */
  function init(){
    fillAttribution();
    initCountdown();
    initReveal();
    initPhone();
    initCheckoutTriggers();
    initAnchors();
    initChoice();
    initForm();
    initFAQ();
    initCookies();
    initCalcCTA();
    initPartners();
    initConsumption();
    initMobileCta();
    initUrgency();
    initPromoRotator();
    initStickyShrink();
    initSound();
    initHeroImage();
    initConfigImages();
    initFounderMedia();
    initBolt();
    initAppTesla();
  }
  if(document.readyState!=='loading') init();
  else document.addEventListener('DOMContentLoaded',init);
})();
