/* =========================================================
   RAYCOM ÉLECTRIQUE — CONFIG & TRACKING BOOTSTRAP
   >>> TOUTES LES VALEURS À REMPLIR SONT ICI <<<
   ========================================================= */
window.CONFIG = {

  /* ---------- COORDONNÉES (mises en évidence) ---------- */
  PHONE:            '450-474-8470',
  PHONE_TEL:        '+14504748470',
  OFFICE_ADDRESS:   '2222, rue Davignac, Mascouche, QC J7K 0K8',
  OFFICE_HOURS:     'Lun.–Jeu. 7 h–17 h · Ven. 7 h–15 h',
  MAPS_URL:         'https://maps.google.com/?q=2222+rue+Davignac+Mascouche+QC+J7K+0K8',

  /* ---------- LÉGAL / REGISTRE (footer, tout petit) ---------- */
  LEGAL_NAME:       'Raycom Électrique inc.',
  RBQ:              '5590-9402-01',
  EMAIL:            'info@raycomelectrique.com',
  SITE_URL:         'https://www.raycomelectrique.com',

  /* ---------- MARQUE ---------- */
  LOGO_URL:         'https://assets.cdn.filesafe.space/Ey6SB5epk8GFGgL5BfhX/media/69d7e917982fd67a35e8a424.png',

  /* ---------- PROMO TESLA ---------- */
  PROMO_DEADLINE:   '2026-06-30T23:59:59-04:00', // date limite remise Tesla
  TESLA_REBATE_PER: 700,   // $ par Powerwall 3 (offerte par Tesla)
  TESLA_REBATE_MAX: 1400,  // plafond

  /* ---------- CALCULATEUR ---------- */
  PW_USABLE_KWH:    13.5,   // kWh utile par Powerwall 3
  HQ_RATE:          0.085,  // $/kWh (tarif Hydro-Québec, configurable)

  /* ---------- PRIX (aucun autre prix affiché) ---------- */
  PRICE_CASH:       16999,  // « à partir de » comptant, + tx
  FINANCE_APR:      0.1299, // 12,99 % FinanceIt
  FINANCE_YEARS:    20,     // amortissement

  /* ---------- INTÉGRATIONS / TRACKING ---------- */
  META_PIXEL_ID:    '815529713850722',
  GA4_ID:           'G-78RJ8XLCBZ',
  GTM_ID:           'GTM-PM898RXB',
  CLARITY_ID:       'wvm6u5crpy',

  // POST JSON du lead (formulaire) -> worker /lead unifié (contact + opp VENTES "Nouveau lead" + Meta CAPI)
  WEBHOOK_URL:      'https://raycom-ghl-worker.proud-leaf-b313.workers.dev/lead',
  // Calendrier de réservation GHL (widget booking) -> rendez-vous = étape VENTES « Contact établi / RV Planifié »
  CALENDAR_URL:     'https://api.leadconnectorhq.com/widget/booking/CyzIMIUVBqfNsysIJVtR',

  /* ---------- MÉDIAS (URLs hébergées — à fournir) ---------- */
  // Laisser '' pour afficher un emplacement balisé (placeholder).
  MEDIA: {
    HERO_VIDEO:       { src:'https://pub-1ccb4ae800c9447583fe56f73bc604ec.r2.dev/videos/powerwall-3-hype.mp4', poster:'https://pub-1ccb4ae800c9447583fe56f73bc604ec.r2.dev/tesla/pw3-dark-1.jpg', label:'Powerwall_3_Hype_Video' },
    LIFESTYLE_VIDEO:  { src:'', poster:'', label:'Powerwall_3_Family_Lifestyle_Video' },
    FEATURES_VIDEO:   { src:'https://pub-1ccb4ae800c9447583fe56f73bc604ec.r2.dev/videos/powerwall-3-features.mp4', poster:'https://pub-1ccb4ae800c9447583fe56f73bc604ec.r2.dev/tesla/pw3-dark-2.jpg', label:'Powerwall_3_Features_and_Benefits' },
    SUBMERGED_VIDEO:  { src:'', poster:'', label:'Powerwall_3_Submerged_Video' },
    FOUNDER_VIDEO:    { src:'', poster:'', label:'Vidéo JF — Fondateur' },
    DRONE_VIDEO:      { src:'', poster:'', label:'Video Drone — Vraies installations' },
    POWERWALL_PHOTO:  { src:'https://pub-1ccb4ae800c9447583fe56f73bc604ec.r2.dev/tesla/pw3-dark-1.jpg', label:'Photo Powerwall 3 — principale' },
    POWERWALL_PHOTO2: { src:'https://pub-1ccb4ae800c9447583fe56f73bc604ec.r2.dev/tesla/pw3-4k-1.jpg', label:'Photo Powerwall 3 — secondaire' }
  }
};

/* =========================================================
   ATTRIBUTION — utm/fbclid/gclid/referrer/page_url
   ========================================================= */
(function () {
  var qp = new URLSearchParams(window.location.search);
  function g(k){ return qp.get(k) || ''; }
  window.RAYCOM_ATTRIBUTION = {
    utm_source:   g('utm_source'),
    utm_medium:   g('utm_medium'),
    utm_campaign: g('utm_campaign'),
    utm_term:     g('utm_term'),
    utm_content:  g('utm_content'),
    fbclid:       g('fbclid'),
    gclid:        g('gclid'),
    referrer:     document.referrer || '',
    page_url:     window.location.href,
    landing_ts:   new Date().toISOString()
  };
  // persiste l'attribution de la 1re visite
  try {
    var stored = JSON.parse(localStorage.getItem('raycom_attr') || 'null');
    if (!stored || stored.fbclid==='' && window.RAYCOM_ATTRIBUTION.fbclid!=='') {
      localStorage.setItem('raycom_attr', JSON.stringify(window.RAYCOM_ATTRIBUTION));
    } else {
      window.RAYCOM_ATTRIBUTION = stored;
    }
  } catch(e){}
})();

/* =========================================================
   HELPERS TRACKING — dédup via event_id partagé Pixel+CAPI
   ========================================================= */
window.genEventId = function () {
  return 'lead_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
};

// PageView Pixel + page_view GA4 sont gérés par les snippets du <head>.
window.trackInitiateCheckout = function (where) {
  try { if (window.fbq) fbq('track', 'InitiateCheckout', { content_name: where || 'calculateur' }); } catch(e){}
  try { if (window.gtag) gtag('event', 'begin_checkout', { step: where || 'calculateur' }); } catch(e){}
  try { if (window.dataLayer) dataLayer.push({ event: 'begin_checkout', step: where || 'calculateur' }); } catch(e){}
};
window.trackContact = function () {
  try { if (window.fbq) fbq('track', 'Contact', { method: 'phone' }); } catch(e){}
  try { if (window.gtag) gtag('event', 'phone_call_click'); } catch(e){}
  try { if (window.dataLayer) dataLayer.push({ event: 'phone_call_click' }); } catch(e){}
};
window.trackLead = function (eventId, payload) {
  try { if (window.fbq) fbq('track', 'Lead', { content_name: 'qualification_powerwall' }, { eventID: eventId }); } catch(e){}
  try { if (window.gtag) gtag('event', 'generate_lead', { event_id: eventId }); } catch(e){}
  try { if (window.dataLayer) dataLayer.push({ event: 'generate_lead', event_id: eventId }); } catch(e){}
};
window.trackSchedule = function () {
  try { if (window.fbq) fbq('track', 'Schedule', { content_name: 'appel_conseil' }); } catch(e){}
  try { if (window.gtag) gtag('event', 'schedule_call'); } catch(e){}
  try { if (window.dataLayer) dataLayer.push({ event: 'schedule_call' }); } catch(e){}
};
