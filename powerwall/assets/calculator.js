/* ============================================================
   CALCULATEUR D'AUTONOMIE — Raycom Powerwall
   Sélection d'appareils -> autonomie selon nb de Powerwall 3
   ============================================================ */
(function(){
  "use strict";
  var C = window.CONFIG || {};
  var USABLE = C.POWERWALL_KWH || 13.5;        // kWh utile / unité
  var BASE_PRICE = C.BASE_PRICE || 16999;       // $ avant taxes, « à partir de »
  var APR_PCT = (C.FINANCE_APR != null ? C.FINANCE_APR : 12.99);
  var APR = APR_PCT / 100;
  var TERM_MONTHS = (C.FINANCE_YEARS || 20) * 12;
  var APR_LABEL = String(APR_PCT).replace('.',',');

  /* --- Appareils : puissance (watts) en mode panne · groupe ess / heat --- */
  var APPLIANCES = [
    { id:"frigo",    nm:"Réfrigérateur",          w:150,  ic:"fridge",  g:"ess" },
    { id:"congel",   nm:"Congélateur",            w:150,  ic:"snow",    g:"ess" },
    { id:"led",      nm:"Éclairage",              w:200,  ic:"bulb",    g:"ess" },
    { id:"tv",       nm:"Internet &amp; TV",          w:150,  ic:"tv",      g:"ess" },
    { id:"ventilo",  nm:"Ventilo-fournaise",      w:600,  ic:"fan",     g:"ess" },
    { id:"puits",    nm:"Pompe à eau (puits)",    w:1000, ic:"droplet", g:"ess" },
    { id:"puisard",  nm:"Pompe de puisard",       w:800,  ic:"droplet", g:"ess" },
    { id:"chauffeeau", nm:"Chauffe-eau",          w:4500, ic:"flame",   g:"heat" },
    { id:"plinthe",  nm:"Plinthe (par pièce)",    w:1500, ic:"thermo",  g:"heat" },
    { id:"thermo",   nm:"Thermopompe",            w:1200, ic:"thermo",  g:"heat" },
    { id:"cuisiniere", nm:"Cuisinière",           w:2500, ic:"stove",   g:"heat" },
    { id:"borneve",  nm:"Borne de recharge VÉ",   w:7200, ic:"car",     g:"heat" }
  ];

  /* --- icônes SVG ligne (stroke currentColor) --- */
  var ICONS = {
    fridge:'<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M6 10h12"/><path d="M9 5v2"/><path d="M9 13v3"/>',
    snow:'<path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19"/>',
    bulb:'<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a6 6 0 0 0-4 10c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 2z"/>',
    fan:'<circle cx="12" cy="12" r="2"/><path d="M12 10c0-3 1-7-1-8-2 1-2 5-2 6M14 12c3 0 7-1 8 1-1 2-5 2-6 1M12 14c0 3-1 7 1 8 2-1 2-5 1-6M10 12c-3 0-7 1-8-1 1-2 5-2 6-1"/>',
    droplet:'<path d="M12 2.5C12 2.5 5 10 5 14.5a7 7 0 0 0 14 0C19 10 12 2.5 12 2.5z"/>',
    flame:'<path d="M12 2c1 4-3 5-3 9a3 3 0 0 0 6 0c0-1-.5-2-1-2.5.5 3-2 3-2 1 0 3 5 3 5-1a8 8 0 0 1-2 6 5 5 0 0 1-5-5c0-5 4-6 4-11z"/>',
    thermo:'<path d="M14 14.76V5a2 2 0 0 0-4 0v9.76a4 4 0 1 0 4 0z"/>',
    stove:'<rect x="4" y="6" width="16" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><circle cx="15" cy="11" r="2"/><path d="M4 6V4M20 6V4"/>',
    tv:'<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
    car:'<path d="M5 12l1.5-4.5A2 2 0 0 1 8.4 6h7.2a2 2 0 0 1 1.9 1.5L19 12M5 12h14v4a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><circle cx="8" cy="14" r=".6" fill="currentColor"/><circle cx="16" cy="14" r=".6" fill="currentColor"/>'
  };

  var MAX_PW = C.MAX_PW || 3;
  var EXP_PER_PW = C.MAX_EXPANSIONS || 3;
  var POWER_PER = C.POWERWALL_KW || 11.5;
  var state = { selected:{}, pw:2, exp:0 };
  // pré-sélection : TOUT le groupe « Essentiels » (ce que la majorité garde en panne)
  APPLIANCES.forEach(function(a){ if(a.g==='ess') state.selected[a.id]=true; });

  function totalUnits(){ return state.pw + state.exp; }
  function capacityKwh(){ return totalUnits()*USABLE; }
  function powerKw(){ return state.pw*POWER_PER; }
  function maxExp(){ return state.pw*EXP_PER_PW; }

  function svg(name){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+(ICONS[name]||"")+'</svg>';
  }
  function fmtMoney(n){ return Math.round(n).toLocaleString('fr-CA'); }

  /* monthly payment — facteur FinanceIt confidentiel (240 mois) sinon amortissement */
  function monthly(principal){
    if(C.FINANCEIT_FACTOR_240) return principal*C.FINANCEIT_FACTOR_240;
    var r = APR/12;
    if(r===0) return principal/TERM_MONTHS;
    return principal * r * Math.pow(1+r,TERM_MONTHS) / (Math.pow(1+r,TERM_MONTHS)-1);
  }
  var FIN_LEGAL = "Paiement mensuel estimatif de 199 $ basé sur un montant financé de 16 999 $ (taxes en sus), à un taux de crédit annuel de 12,99 %, sur 240 mois — programme de crédit standard FinanceIt, Québec. Frais de crédit et montant total variables. Prêt ouvert, sans pénalité. Sous réserve de l’approbation de crédit par FinanceIt Canada inc. Estimation seulement; les paiements réels peuvent varier. Taux et modalités sujets à changement, offerts au Québec seulement.";

  /* charge instantanée moyenne sélectionnée (kW) */
  function loadKW(){
    var w=0;
    APPLIANCES.forEach(function(a){ if(state.selected[a.id]) w+=a.w; });
    return w/1000;
  }

  /* config recommandée : assez de puissance + ~8 h d'autonomie */
  function recommendedConfig(){
    var kw=loadKW();
    if(kw<=0) return {pw:1,exp:0};
    var pw=Math.max(1,Math.min(MAX_PW,Math.ceil(kw/POWER_PER)));
    var needUnits=Math.ceil((kw*8)/USABLE);
    var exp=Math.max(0,Math.min(pw*EXP_PER_PW, needUnits-pw));
    return {pw:pw,exp:exp};
  }

  /* ---------- animated number ---------- */
  function animateNum(el, to, decimals, suffix){
    var from = parseFloat(el.getAttribute('data-cur')||"0");
    var start = performance.now(), dur=650;
    function step(now){
      var p=Math.min(1,(now-start)/dur);
      var e=1-Math.pow(1-p,3);
      var val=from+(to-from)*e;
      el.textContent = val.toFixed(decimals).replace('.',',')+(suffix||"");
      if(p<1) requestAnimationFrame(step);
      else el.setAttribute('data-cur',to);
    }
    requestAnimationFrame(step);
  }

  function fmtAutonomy(hours){
    if(hours>=48){ return { num:hours/24, un:"jours", dec:1 }; }
    return { num:hours, un:"heures", dec:hours<10?1:0 };
  }

  /* ---------- render ---------- */
  function renderAppliances(){
    var wrap=document.getElementById('applianceGrid');
    if(!wrap) return;
    function btnHtml(a){
      var on=state.selected[a.id]?' on':'';
      return '<button type="button" class="appliance'+on+'" data-id="'+a.id+'" aria-pressed="'+(!!state.selected[a.id])+'">'+
        '<span class="ic">'+svg(a.ic)+'</span>'+
        '<span class="nm">'+a.nm+'</span>'+
        '<span class="wt">'+a.w.toLocaleString('fr-CA')+'\u00a0W</span>'+
        '<span class="check"><svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 6"/></svg></span>'+
        '</button>';
    }
    function group(g,label){
      var items=APPLIANCES.filter(function(a){return a.g===g;});
      return '<div class="appl-group-label">'+label+'</div><div class="appliances">'+items.map(btnHtml).join('')+'</div>';
    }
    wrap.innerHTML=group('ess','Essentiels')+group('heat','Chauffage &amp; gros appareils');
    wrap.querySelectorAll('.appliance').forEach(function(btn){
      btn.addEventListener('click',function(){
        var id=btn.getAttribute('data-id');
        state.selected[id]=!state.selected[id];
        btn.classList.toggle('on',state.selected[id]);
        btn.setAttribute('aria-pressed',!!state.selected[id]);
        update(true);
      });
    });
  }

  function renderBars(){
    var bars=document.getElementById('cfgBars');
    if(!bars) return;
    var html="";
    for(var i=0;i<state.pw;i++){ html+='<i class="bar pw" title="Powerwall 3"></i>'; }
    for(var j=0;j<state.exp;j++){ html+='<i class="bar exp" title="Expansion"></i>'; }
    bars.innerHTML=html;
    var cu=document.getElementById('cfgUnits');
    if(cu) cu.textContent=totalUnits()+(totalUnits()>1?' batteries':' batterie');
    var ck=document.getElementById('cfgKwh');
    if(ck) ck.textContent=capacityKwh().toFixed(1).replace('.',',')+' kWh';
    var pv=document.getElementById('pwVal'); if(pv) pv.textContent=state.pw;
    var ev=document.getElementById('expVal'); if(ev) ev.textContent=state.exp;
    // disable states
    setDisabled('pw-',state.pw<=1); setDisabled('pw+',state.pw>=MAX_PW);
    setDisabled('exp-',state.exp<=0); setDisabled('exp+',state.exp>=maxExp());
  }
  function setDisabled(act,on){
    var b=document.querySelector('.st-btn[data-act="'+act+'"]');
    if(b) b.disabled=on;
  }

  function renderConfig(){
    var box=document.getElementById('configBox');
    if(!box) return;
    box.querySelectorAll('.st-btn').forEach(function(btn){
      btn.addEventListener('click',function(){
        var act=btn.getAttribute('data-act');
        if(act==='pw+'  && state.pw<MAX_PW){ state.pw++; if(state.exp>maxExp()) state.exp=maxExp(); }
        if(act==='pw-'  && state.pw>1){ state.pw--; if(state.exp>maxExp()) state.exp=maxExp(); }
        if(act==='exp+' && state.exp<maxExp()) state.exp++;
        if(act==='exp-' && state.exp>0) state.exp--;
        renderBars();
        update(true);
      });
    });
    renderBars();
  }

  function update(animate){
    var kw=loadKW();
    var cap=capacityKwh();             // kWh disponibles
    var hours = kw>0 ? cap/kw : 0;
    var a=fmtAutonomy(hours);

    var numEl=document.getElementById('resNum');
    var unEl=document.getElementById('resUn');
    if(numEl){ if(animate) animateNum(numEl,a.num,a.dec,""); else numEl.textContent=a.num.toFixed(a.dec).replace('.',','); }
    if(unEl) unEl.textContent=a.un;

    var loadEl=document.getElementById('resLoad');
    if(loadEl) loadEl.textContent=kw.toFixed(2).replace('.',',')+' kW';
    var capEl=document.getElementById('resCap');
    if(capEl){
      var lbl=state.pw+' Powerwall 3'+(state.exp>0?(' + '+state.exp+' expansion'+(state.exp>1?'s':'')):'');
      capEl.textContent=lbl+' · '+cap.toFixed(1).replace('.',',')+' kWh';
    }
    var cntEl=document.getElementById('resCount');
    if(cntEl) cntEl.textContent=Object.keys(state.selected).filter(function(k){return state.selected[k];}).length+' appareils';

    // recommendation highlight
    var reco=recommendedConfig();
    var recoMsg=document.getElementById('recoMsg');
    if(recoMsg){
      var lblr=reco.pw+' Powerwall 3'+(reco.exp>0?(' + '+reco.exp+' expansion'+(reco.exp>1?'s':'')):'');
      if(kw>powerKw()){
        recoMsg.innerHTML='Cette sélection demande beaucoup de puissance d\u2019un coup — nous suggérons <b>'+lblr+'</b>. À valider lors de votre évaluation.';
      }else{
        recoMsg.innerHTML='Pour vos appareils, nous suggérons <b>'+lblr+'</b> — affiné lors de votre évaluation.';
      }
    }

    // hidden field for the form
    var hid=document.getElementById('field_calc');
    if(hid){
      hid.value=JSON.stringify({
        powerwalls:state.pw,
        expansions:state.exp,
        units_total:totalUnits(),
        capacity_kwh:+cap.toFixed(1),
        power_kw:+powerKw().toFixed(1),
        load_kw:+kw.toFixed(2),
        autonomy_hours:+hours.toFixed(1),
        appliances:Object.keys(state.selected).filter(function(k){return state.selected[k];})
      });
    }
    var sumEl=document.getElementById('field_calc_summary');
    if(sumEl){
      var sl=state.pw+' Powerwall 3'+(state.exp>0?(' + '+state.exp+' exp.'):'');
      sumEl.value=sl+' · '+a.num.toFixed(a.dec)+' '+a.un+' d\u2019autonomie · charge '+kw.toFixed(2).replace('.',',')+' kW';
    }
  }

  function renderPricing(){
    var cash=BASE_PRICE;
    var mo=monthly(BASE_PRICE);
    var cashEl=document.getElementById('priceCash');
    if(cashEl) cashEl.innerHTML=fmtMoney(cash)+' $ <small>+ tx</small>';
    var moEl=document.getElementById('priceMonthly');
    if(moEl) moEl.innerHTML='~'+fmtMoney(mo)+' $ <small>/mois + tx</small>';
    var finEl=document.getElementById('financeTerms');
    if(finEl) finEl.innerHTML='FinanceIt · <b>'+APR_LABEL+' %</b> sur <b>'+(C.FINANCE_YEARS||20)+' ans</b>';
    // also the value-stack aside
    var asCash=document.getElementById('asideCash');
    if(asCash) asCash.innerHTML=fmtMoney(cash)+' $ <small>+ tx</small>';
    var asMo=document.getElementById('asideMonthly');
    if(asMo) asMo.innerHTML='ou à partir de <b>~'+fmtMoney(mo)+' $/mois</b> · FinanceIt '+APR_LABEL+' % / '+(C.FINANCE_YEARS||20)+' ans';
    var leg1=document.getElementById('financeLegal'); if(leg1) leg1.textContent=FIN_LEGAL;
    var leg2=document.getElementById('financeLegalAside'); if(leg2) leg2.textContent=FIN_LEGAL;
  }

  function init(){
    renderAppliances();
    renderConfig();
    renderPricing();
    update(false);
    // first reveal animation when scrolled into view
    var calcSec=document.getElementById('calculateur');
    if(calcSec){
      var io=new IntersectionObserver(function(es){
        es.forEach(function(e){ if(e.isIntersecting){ update(true); io.disconnect(); } });
      },{threshold:.3});
      io.observe(calcSec);
    }
  }

  window.RaycomCalc = { init:init, getState:function(){return state;} };
  if(document.readyState!=='loading') init();
  else document.addEventListener('DOMContentLoaded',init);
})();
