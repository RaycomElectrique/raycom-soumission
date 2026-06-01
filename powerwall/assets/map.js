/* ============================================================
   ZONE DE SERVICE — carte Leaflet + admissibilité 150 km
   ============================================================ */
(function(){
  "use strict";
  var C = window.CONFIG || {};
  var OFFICE = [C.OFFICE_LAT||45.7352, C.OFFICE_LNG||-73.6097];
  var RADIUS_KM = C.SERVICE_RADIUS_KM || 150;
  var map, userMarker, userLine;

  function haversine(a,b){
    var R=6371, toRad=function(d){return d*Math.PI/180;};
    var dLat=toRad(b[0]-a[0]), dLng=toRad(b[1]-a[1]);
    var s=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(toRad(a[0]))*Math.cos(toRad(b[0]))*Math.sin(dLng/2)*Math.sin(dLng/2);
    return R*2*Math.atan2(Math.sqrt(s),Math.sqrt(1-s));
  }

  function officePin(){
    return L.divIcon({className:'zone-pin radar-pin',html:'<span class="radar-ring"></span><span class="radar-ring r2"></span><svg width="34" height="34" viewBox="0 0 24 24" fill="none"><path d="M12 22s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12z" fill="#3fb574" stroke="#06210f" stroke-width="1"/><circle cx="12" cy="10" r="2.6" fill="#06210f"/></svg>',iconSize:[34,34],iconAnchor:[17,32]});
  }
  function userPin(ok){
    var col=ok?'#5CB87A':'#C8CCD2';
    return L.divIcon({className:'zone-pin',html:'<svg width="30" height="30" viewBox="0 0 24 24" fill="none"><path d="M12 22s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12z" fill="'+col+'" stroke="#0b0b0d" stroke-width="1"/><circle cx="12" cy="10" r="2.5" fill="#0b0b0d"/></svg>',iconSize:[30,30],iconAnchor:[15,28]});
  }

  function initMap(){
    var el=document.getElementById('zoneMap');
    if(!el || typeof L==='undefined') return;
    map=L.map(el,{zoomControl:false,scrollWheelZoom:false,attributionControl:true}).setView(OFFICE, 8);
    L.control.zoom({position:'topright'}).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{
      maxZoom:19, subdomains:'abcd',
      attribution:'© OpenStreetMap © CARTO'
    }).addTo(map);
    // service radius (vert)
    L.circle(OFFICE,{radius:RADIUS_KM*1000, color:'#3fb574', weight:1.5, opacity:.85, fillColor:'#3fb574', fillOpacity:.08}).addTo(map);
    L.circle(OFFICE,{radius:RADIUS_KM*1000, color:'#3fb574', weight:0, fillColor:'#3fb574', fillOpacity:.04}).addTo(map);
    L.marker(OFFICE,{icon:officePin()}).addTo(map).bindPopup('Raycom Électrique — Point de vente<br>'+(C.OFFICE_ADDRESS||'Mascouche'));
    // fit the circle nicely
    setTimeout(function(){ try{ map.fitBounds(L.latLng(OFFICE).toBounds(RADIUS_KM*2200)); map.invalidateSize(); }catch(e){} },200);
  }

  function setResult(kind, html){
    var r=document.getElementById('zoneResult');
    if(!r) return;
    r.className='zone-result show '+kind;
    r.innerHTML=html;
  }

  function geocode(q){
    var url='https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ca&q='+encodeURIComponent(q);
    return fetch(url,{headers:{'Accept':'application/json'}}).then(function(r){return r.json();});
  }

  function track(name,params){
    try{ if(window.fbq) fbq('trackCustom',name,params||{}); }catch(e){}
    try{ if(window.gtag) gtag('event',name,params||{}); }catch(e){}
    try{ window.dataLayer=window.dataLayer||[]; window.dataLayer.push(Object.assign({event:name},params||{})); }catch(e){}
  }

  function prefillForm(addr){
    var f=document.querySelector('#leadForm [name="address"]');
    if(f && !f.value) f.value=addr;
  }
  function gotoForm(){
    var el=document.getElementById('rendezvous');
    if(el){ var y=el.getBoundingClientRect().top+window.pageYOffset-90; window.scrollTo({top:y,behavior:'smooth'}); }
  }

  function check(){
    var input=document.getElementById('zoneAddr');
    var btn=document.getElementById('zoneCheck');
    if(!input) return;
    var q=(input.value||'').trim();
    if(q.length<3){ setResult('err','<div class="zr-head"><span class="zr-t">Entrez votre adresse ou ville</span></div><p>Indiquez au moins votre municipalité pour vérifier l\u2019admissibilité.</p>'); return; }
    if(btn){ btn.disabled=true; btn.textContent='…'; }
    track('eligibility_check',{query:q});

    geocode(q).then(function(res){
      if(btn){ btn.disabled=false; btn.textContent='Vérifier'; }
      if(!res || !res.length){
        setResult('err','<div class="zr-head"><span class="zr-t">Adresse introuvable</span></div><p>Essayez avec votre ville (ex. « Terrebonne ») — ou laissez-nous vos coordonnées, nous vous confirmons rapidement.</p><button class="zr-cta" id="zrForm">Demander une confirmation →</button>');
        wireCta(q,false,0);
        return;
      }
      var lat=parseFloat(res[0].lat), lng=parseFloat(res[0].lon);
      var dist=Math.round(haversine(OFFICE,[lat,lng]));
      var ok=dist<=RADIUS_KM;
      // map marker + line
      if(map){
        if(userMarker) map.removeLayer(userMarker);
        if(userLine) map.removeLayer(userLine);
        userMarker=L.marker([lat,lng],{icon:userPin(ok)}).addTo(map);
        userLine=L.polyline([OFFICE,[lat,lng]],{color:ok?'#5CB87A':'#C8CCD2',weight:2,dashArray:'5 6',opacity:.8}).addTo(map);
        try{ map.fitBounds(L.latLngBounds([OFFICE,[lat,lng]]).pad(0.4)); }catch(e){}
      }
      if(ok){
        setResult('ok','<div class="zr-head"><span class="zr-ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg></span><span class="zr-t">Bonne nouvelle — nous installons chez vous&nbsp;!</span></div><p>Votre propriété est à environ <b style="color:var(--ivory)">'+dist+'\u00a0km</b> de notre bureau, dans notre zone de service. Réservez votre évaluation gratuite.</p><button class="zr-cta" id="zrForm">Réserver mon évaluation →</button>');
        track('eligibility_eligible',{distance_km:dist});
      }else{
        setResult('far','<div class="zr-head"><span class="zr-ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v5M12 16v0"/><circle cx="12" cy="12" r="9"/></svg></span><span class="zr-t">Un peu plus loin — parlons-en</span></div><p>Vous êtes à environ <b style="color:var(--ivory)">'+dist+'\u00a0km</b>, au-delà de notre rayon habituel de '+RADIUS_KM+'\u00a0km. Certains projets restent possibles — laissez-nous vos coordonnées et nous regardons avec vous.</p><button class="zr-cta" id="zrForm">Vérifier avec un conseiller →</button>');
        track('eligibility_far',{distance_km:dist});
      }
      wireCta(res[0].display_name||q, ok, dist);
    }).catch(function(){
      if(btn){ btn.disabled=false; btn.textContent='Vérifier'; }
      setResult('err','<div class="zr-head"><span class="zr-t">Vérification indisponible</span></div><p>Pas de souci — entrez votre adresse dans le formulaire ci-dessous et nous confirmons votre admissibilité avec vous.</p><button class="zr-cta" id="zrForm">Aller au formulaire →</button>');
      wireCta(q,false,0);
    });
  }

  function wireCta(addr, ok, dist){
    var b=document.getElementById('zrForm');
    if(b) b.addEventListener('click',function(){
      prefillForm(addr);
      var hid=document.querySelector('#leadForm');
      if(hid){
        var note=hid.querySelector('[name="eligibility"]');
        if(!note){ note=document.createElement('input'); note.type='hidden'; note.name='eligibility'; hid.appendChild(note); }
        note.value=(ok?'dans la zone':'hors zone')+(dist?(' ~'+dist+' km'):'');
      }
      gotoForm();
    });
  }

  function init(){
    initMap();
    var btn=document.getElementById('zoneCheck'), input=document.getElementById('zoneAddr');
    if(btn) btn.addEventListener('click',check);
    if(input) input.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); check(); } });
    // (re)size map when it scrolls into view
    var el=document.getElementById('zoneMap');
    if(el && 'IntersectionObserver' in window){
      var io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting && map){ map.invalidateSize(); } }); },{threshold:.2});
      io.observe(el);
    }
  }
  if(document.readyState!=='loading') init();
  else document.addEventListener('DOMContentLoaded',init);
})();
