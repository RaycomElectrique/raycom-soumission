// ============================================================
//  RAYCOM LEAD PROXY — Cloudflare Worker v3
//  Reçoit les POST du formulaire GitHub Pages et orchestre GHL
// ============================================================
//  Secrets Cloudflare (Settings → Variables) :
//    GHL_TOKEN              Bearer PIT (pit-xxxxx)
//    GHL_LOCATION_ID        Ey6SB5epk8GFGgL5BfhX
//    GHL_PIPELINE_ID        iXxbCQTd0UOm3AMcRxIQ
//    GHL_STAGE_ID           7ad5fc70-eadb-4929-b92e-07a7fa667b0f
//    INTERNAL_PHONE         +14388016401   (SMS business — PAS de cell perso)
//    INTERNAL_EMAIL         info@raycomelectrique.com
//    FROM_EMAIL             info@raycomelectrique.com
//    GHL_FROM_NUMBER        +14388016401
// ============================================================

const ALLOWED_ORIGINS = [
  'https://raycomelectrique.github.io',
  'https://raycomelectrique.com',
  'https://www.raycomelectrique.com',
  'https://soumission.raycomelectrique.com',
  'https://raycom-soumission.proud-leaf-b313.workers.dev',
];

const GHL_BASE    = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';

// ============================================================
//  MATRICE DE PRIX — Valeur opportunité automatique
// ============================================================
const PRIX_BASE = {
  'Panneaux solaires':       35000,
  'Batterie de stockage':    14000,
  'Borne de recharge VÉ':    3500,
  'Travaux électriques':     7500,
  'Génératrice':             8000,
  'Inspection / Diagnostic': 500,
};

const MULT_SEGMENT = {
  'Résidentiel':  1.0,
  'Commercial':   2.8,
  'Multilogement':2.2,
  'Municipal':    3.5,
  'Agricole':     2.0,
};

const MULT_CONSO = {
  '< 100 $/mois (~10 000 kWh/an)':        0.75,
  '100-200 $/mois (10-20 000 kWh/an)':    1.00,
  '200-300 $/mois (20-30 000 kWh/an)':    1.35,
  '300-500 $/mois (30-50 000 kWh/an)':    1.70,
  '500+ $/mois (50 000+ kWh/an)':         2.20,
};

function calculateOpportunityValue(p) {
  const composantes = Array.isArray(p.projet_composantes)
    ? p.projet_composantes
    : (p.projet_composantes_str || '').split(',').map(s => s.trim()).filter(Boolean);

  const segment = p.projet_segment || 'Résidentiel';
  const conso   = p.hq_consommation_bracket || '';
  const nature  = p.projet_nature || 'Existant';

  if (nature === 'Construction neuve') {
    return Math.round((MULT_SEGMENT[segment] || 1.0) * 50000 / 500) * 500;
  }

  if (composantes.length === 0) return 5000;

  const hasSolaire  = composantes.includes('Panneaux solaires');
  const hasBatterie = composantes.includes('Batterie de stockage');
  const multSeg     = MULT_SEGMENT[segment] || 1.0;
  const multConso   = hasSolaire ? (MULT_CONSO[conso] || 1.0) : 1.0;

  let total = 0;
  for (const c of composantes) {
    const base = PRIX_BASE[c] || 2000;
    total += (c === 'Panneaux solaires') ? base * multConso : base;
  }
  if (hasSolaire && hasBatterie) total += 5000; // bonus combo câblage/onduleur

  return Math.round((total * multSeg) / 500) * 500;
}

// ============================================================
//  HELPERS
// ============================================================
function cors(origin) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : '*';
  return {
    'Access-Control-Allow-Origin':  allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age':       '86400',
  };
}

async function ghl(env, path, method = 'GET', body) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${env.GHL_TOKEN}`,
      'Version':       GHL_VERSION,
      'Content-Type':  'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json };
}

function html(t) {
  return (t == null ? '' : String(t)).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'": '&#39;' }[c])
  );
}

async function getAssignedUserId(env) {
  try {
    const res = await ghl(env, `/users/search?locationId=${env.GHL_LOCATION_ID}&email=${encodeURIComponent(env.INTERNAL_EMAIL)}&type=location`);
    const users = res.json?.users || [];
    if (users.length > 0) return users[0].id;
    const all = await ghl(env, `/users/search?locationId=${env.GHL_LOCATION_ID}&type=location`);
    return all.json?.users?.[0]?.id || null;
  } catch { return null; }
}

// ============================================================
//  EMAILS & SMS
// ============================================================
function buildLeadEmail(p) {
  const composantes = p.projet_composantes_str || p.projet_nature || '';
  return `
<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:14px;line-height:1.6;max-width:620px;">

<!-- HEADER -->
<div style="background:linear-gradient(135deg,#0a1b3d 0%,#1B5DC8 100%);padding:28px 30px;border-radius:10px 10px 0 0;text-align:center;">
  <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:0.5px;">RAYCOM ÉLECTRIQUE</div>
  <div style="font-size:12px;color:#a8c4e8;margin-top:4px;text-transform:uppercase;letter-spacing:2px;">Maître électricien certifié · RBQ 5590-9402-01</div>
</div>

<!-- CORPS -->
<div style="background:#fff;padding:28px 30px;border:1px solid #dbe3ef;border-top:none;">
  <p style="font-size:16px;font-weight:600;color:#0E1E4A;">Bonjour ${html(p['First name'])},</p>
  <p>Merci pour votre confiance. Nous avons bien reçu votre demande de soumission et nous sommes heureux de vous accompagner dans votre projet.</p>
  <p>Un membre de notre équipe vous contactera dans les <strong style="color:#0E1E4A;">24 heures ouvrables</strong> pour discuter de votre projet en détail et établir une soumission personnalisée.</p>

  <!-- RÉCAP PROJET -->
  <div style="background:#f4f7fc;border-left:4px solid #1B5DC8;padding:14px 18px;border-radius:0 8px 8px 0;margin:20px 0;font-size:13px;">
    <div style="font-weight:700;color:#0E1E4A;margin-bottom:8px;">Votre demande en un coup d'œil</div>
    <div style="color:#444;line-height:1.8;">
      <strong>Projet :</strong> ${html(composantes)}<br>
      <strong>Type :</strong> ${html(p.projet_segment)} · ${html(p.projet_nature)}<br>
      ${p.hq_consommation_bracket ? `<strong>Consommation HQ :</strong> ${html(p.hq_consommation_bracket)}<br>` : ''}
      <strong>Adresse :</strong> ${html(p.City)}, ${html(p.State)}
    </div>
  </div>

  <p>En attendant, n'hésitez pas à nous joindre directement si vous avez des questions :</p>
  <p style="margin:6px 0;">📞 <a href="tel:4504748470" style="color:#1B5DC8;text-decoration:none;font-weight:600;">450-474-8470</a></p>
  <p style="margin:6px 0;">💬 <a href="sms:4388016401" style="color:#1B5DC8;text-decoration:none;font-weight:600;">438-801-6401</a> (texto)</p>
  <p style="margin:6px 0;">✉️ <a href="mailto:info@raycomelectrique.com" style="color:#1B5DC8;text-decoration:none;font-weight:600;">info@raycomelectrique.com</a></p>

  <p style="margin-top:24px;color:#555;font-size:13px;">Cordialement,</p>
  <p style="margin-top:4px;">— L'équipe Raycom Électrique</p>
</div>
<table cellpadding="0" cellspacing="0" border="0" style="border-top:3px solid #1B5DC8;margin-top:18px;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:13px;line-height:1.5;width:100%;">
<tr>
<td style="padding:14px 0 0 0;vertical-align:top;">
<div style="font-size:15px;font-weight:700;color:#0E1E4A;">Jean-François Rayle</div>
<div style="font-size:11px;color:#1B5DC8;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-top:3px;">Président • Maître électricien</div>
<div style="font-size:12px;font-weight:700;color:#0E1E4A;margin-top:8px;letter-spacing:0.5px;">RAYCOM ÉLECTRIQUE INC.</div>
<div style="font-size:12px;color:#555;margin-top:5px;line-height:1.7;">
3321 Ave de la Gare #112, Mascouche, QC&nbsp;&nbsp;J7K 0X7<br>
Tél. <a href="tel:4504748470" style="color:#555;text-decoration:none;">450-474-8470</a>&nbsp;&nbsp;•&nbsp;&nbsp;Cell <a href="tel:4388016401" style="color:#555;text-decoration:none;">438-801-6401</a><br>
<a href="mailto:info@raycomelectrique.com" style="color:#1B5DC8;text-decoration:none;">info@raycomelectrique.com</a>&nbsp;&nbsp;•&nbsp;&nbsp;<a href="https://www.raycomelectrique.com" style="color:#1B5DC8;text-decoration:none;font-weight:600;">raycomelectrique.com</a><br>
<span style="color:#999;font-size:11px;">RBQ 5590-9402-01</span>
</div>
</td>
</tr>
<tr>
<td style="padding:10px 0 0 0;border-top:1px solid #e0e0e0;">
<div style="font-size:10px;color:#1B5DC8;text-transform:uppercase;letter-spacing:1.2px;font-weight:700;padding-top:8px;">⚡ Partenaires certifiés : Tesla Powerwall&nbsp;•&nbsp;Sigenergy&nbsp;•&nbsp;Fox ESS&nbsp;•&nbsp;Financeit</div>
</td>
</tr>
</table>
</div>`;
}

function buildLeadSMS(p) {
  return `Bonjour ${p['First name']}, c'est Raycom Électrique. On a bien reçu votre demande pour votre projet ${p.projet_composantes_str || p.projet_nature}. On vous contacte sous 24h ouvrables. — Jean-François`;
}

function buildInternalEmail(p, contactId, oppValue) {
  const valFmt = oppValue ? `${oppValue.toLocaleString('fr-CA')} $` : 'N/A';
  const composantes = p.projet_composantes_str || p.projet_nature || '—';
  const ville = [p.City, p.State].filter(Boolean).join(', ') || '—';
  // Résumé intentions : segment + composantes + consommation HQ
  const intentions = [
    p.projet_segment,
    composantes,
    p.hq_consommation_bracket ? `Conso HQ : ${p.hq_consommation_bracket}` : null,
    p.projet_nature === 'Construction neuve' ? 'Construction neuve' : null,
  ].filter(Boolean).join(' · ');

  return `
<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:14px;line-height:1.5;max-width:640px;">

<!-- EN-TÊTE LEAD -->
<div style="background:#0E1E4A;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
  <div style="font-size:18px;font-weight:700;">🔥 Nouveau lead — ${html(p.projet_segment)}</div>
  <div style="font-size:13px;color:#a8c4e8;margin-top:4px;">${html(intentions)}</div>
</div>

<!-- BLOC CONTACT + VALEUR -->
<table cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #dbe3ef;border-top:none;border-radius:0 0 8px 8px;background:#fff;">
<tr>
  <td style="padding:16px 20px;vertical-align:top;width:55%;">
    <div style="font-size:16px;font-weight:700;color:#0E1E4A;">${html(p['First name'])} ${html(p['Last name'])}</div>
    <div style="margin-top:6px;font-size:13px;color:#444;">
      📍 ${html(ville)}<br>
      📞 <a href="tel:${html(p.Phone)}" style="color:#1B5DC8;text-decoration:none;">${html(p.Phone)}</a><br>
      ✉️ <a href="mailto:${html(p.Email)}" style="color:#1B5DC8;text-decoration:none;">${html(p.Email)}</a>
    </div>
  </td>
  <td style="padding:16px 20px;vertical-align:top;text-align:right;border-left:1px solid #dbe3ef;">
    <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;">Valeur pipeline</div>
    <div style="font-size:24px;font-weight:800;color:#1B5DC8;">${html(valFmt)}</div>
  </td>
</tr>
</table>

<!-- TABLEAU PROJET -->
<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px;border:1px solid #dbe3ef;border-radius:8px;overflow:hidden;">
<tr style="background:#f0f4fb;">
  <td style="padding:8px 14px;font-weight:700;color:#0E1E4A;border-bottom:1px solid #dbe3ef;" colspan="2">Détails du projet</td>
</tr>
<tr><td style="padding:7px 14px;color:#666;width:170px;border-bottom:1px solid #f0f4fb;">Segment</td><td style="padding:7px 14px;font-weight:600;border-bottom:1px solid #f0f4fb;">${html(p.projet_segment)}</td></tr>
<tr style="background:#f9fbfe;"><td style="padding:7px 14px;color:#666;border-bottom:1px solid #f0f4fb;">Nature</td><td style="padding:7px 14px;border-bottom:1px solid #f0f4fb;">${html(p.projet_nature)}</td></tr>
<tr><td style="padding:7px 14px;color:#666;border-bottom:1px solid #f0f4fb;">Composantes</td><td style="padding:7px 14px;font-weight:600;color:#0E1E4A;border-bottom:1px solid #f0f4fb;">${html(composantes)}</td></tr>
<tr style="background:#f9fbfe;"><td style="padding:7px 14px;color:#666;border-bottom:1px solid #f0f4fb;">Consommation HQ</td><td style="padding:7px 14px;border-bottom:1px solid #f0f4fb;">${html(p.hq_consommation_bracket) || '—'}</td></tr>
<tr><td style="padding:7px 14px;color:#666;border-bottom:1px solid #f0f4fb;">Ville</td><td style="padding:7px 14px;font-weight:600;border-bottom:1px solid #f0f4fb;">${html(ville)}</td></tr>
<tr style="background:#f9fbfe;"><td style="padding:7px 14px;color:#666;" colspan="2">💬 Notes : ${html(p.projet_notes) || '(aucune)'}</td></tr>
</table>

<!-- DOCUMENTS -->
${(p.doc_facture_hq || p.photos_panneau || p.photos_compteur || p.photos_emplacement || p.doc_plans) ? `
<div style="margin-top:12px;padding:10px 14px;background:#f9fbfe;border:1px solid #dbe3ef;border-radius:8px;font-size:12px;">
  <strong>📎 Documents reçus :</strong><br>
  ${p.doc_facture_hq ? `📄 <a href="${html(p.doc_facture_hq)}" style="color:#1B5DC8;">Facture HQ</a>  &nbsp;` : ''}
  ${p.photos_panneau ? `📸 <a href="${html(p.photos_panneau)}" style="color:#1B5DC8;">Panneau électrique</a>  &nbsp;` : ''}
  ${p.photos_compteur ? `📸 <a href="${html(p.photos_compteur)}" style="color:#1B5DC8;">Compteur</a>  &nbsp;` : ''}
  ${p.photos_emplacement ? `📸 <a href="${html(p.photos_emplacement)}" style="color:#1B5DC8;">Emplacement</a>  &nbsp;` : ''}
  ${p.doc_plans ? `📐 <a href="${html(p.doc_plans)}" style="color:#1B5DC8;">Plans</a>` : ''}
</div>` : ''}

<!-- CTA GHL -->
<p style="margin-top:16px;">
<a href="https://app.gohighlevel.com/v2/location/${html(p._locationId)}/contacts/detail/${html(contactId)}" style="background:#1B5DC8;color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">→ Ouvrir dans GHL</a>
</p>

</div>`;
}

function buildInternalSMS(p, oppValue) {
  const val = oppValue ? `~${Math.round(oppValue / 1000)}k$` : '';
  return `🔥 ${p['First name']} ${p['Last name']} ${val} — ${p.projet_composantes_str || p.projet_nature}. ${p.Phone}. ${p.City}`;
}

// ============================================================
//  HANDLER PRINCIPAL
// ============================================================
async function handleSubmit(request, env) {
  const origin = request.headers.get('Origin') || '';
  const corsH  = cors(origin);
  const p      = await request.json();
  p._locationId = env.GHL_LOCATION_ID;

  const results = { steps: {} };

  // Valeur opportunité
  const oppValue = p.budget_estime
    ? parseInt(p.budget_estime, 10)
    : calculateOpportunityValue(p);
  results.oppValue = oppValue;

  // 1. UPSERT CONTACT
  const tags = [
    p.projet_segment && `segment:${p.projet_segment}`,
    p.projet_composantes_str && `composante:${p.projet_composantes_str.split(',')[0].trim()}`,
    'source:formulaire-web',
  ].filter(Boolean);

  const upsert = await ghl(env, '/contacts/upsert', 'POST', {
    locationId: env.GHL_LOCATION_ID,
    firstName:  p['First name'],
    lastName:   p['Last name'],
    email:      p.Email,
    phone:      p.Phone,
    address1:   p.Address,
    city:       p.City,
    state:      p.State,
    postalCode: p['Postal code'],
    country:    p.Country || 'CA',
    source:     p.source || 'Formulaire web',
    tags,
  });
  results.steps.upsert = { status: upsert.status, ok: upsert.ok };

  if (!upsert.ok) {
    return new Response(
      JSON.stringify({ error: 'upsert_failed', detail: upsert.json }),
      { status: 500, headers: { ...corsH, 'Content-Type': 'application/json' } }
    );
  }
  const contactId = upsert.json.contact?.id || upsert.json.id;
  results.contactId = contactId;

  // 2. NOTE
  const noteLines = [
    '=== Projet ===',
    `Segment: ${p.projet_segment || ''}`,
    `Nature: ${p.projet_nature || ''}`,
    `Composantes: ${p.projet_composantes_str || ''}`,
    `Consommation HQ: ${p.hq_consommation_bracket || ''}`,
    `Valeur estimée: ${oppValue.toLocaleString('fr-CA')} $`,
    '',
    '=== Notes client ===',
    p.projet_notes || '(aucune)',
    '',
    '=== Documents ===',
    p.doc_facture_hq     ? `Facture HQ: ${p.doc_facture_hq}`     : null,
    p.photos_panneau     ? `Panneau: ${p.photos_panneau}`         : null,
    p.photos_compteur    ? `Compteur: ${p.photos_compteur}`       : null,
    p.photos_emplacement ? `Emplacement: ${p.photos_emplacement}` : null,
    p.doc_plans          ? `Plans: ${p.doc_plans}`                : null,
    p.doc_autres         ? `Autres: ${p.doc_autres}`              : null,
    '',
    `Soumis: ${p.submitted_at || new Date().toISOString()}`,
  ].filter(Boolean).join('\n');

  const note = await ghl(env, `/contacts/${contactId}/notes`, 'POST', { body: noteLines });
  results.steps.note = { status: note.status, ok: note.ok };

  // 3. AUTO-ASSIGN
  const assignedUserId = await getAssignedUserId(env);
  results.assignedUserId = assignedUserId;

  // 4. OPPORTUNITÉ
  const oppPayload = {
    locationId:      env.GHL_LOCATION_ID,
    pipelineId:      env.GHL_PIPELINE_ID,
    pipelineStageId: env.GHL_STAGE_ID,
    name:            `${p['First name']} ${p['Last name']} — ${p.projet_composantes_str || p.projet_segment || 'Lead'}`,
    status:          'open',
    contactId,
    source:          p.source || 'Formulaire web',
    monetaryValue:   oppValue,
  };
  if (assignedUserId) oppPayload.assignedTo = assignedUserId;

  const opp = await ghl(env, '/opportunities/', 'POST', oppPayload);
  results.steps.opportunity = { status: opp.status, ok: opp.ok };

  // 5. SMS LEAD
  const smsLead = await ghl(env, '/conversations/messages', 'POST', {
    type:       'SMS',
    contactId,
    fromNumber: env.GHL_FROM_NUMBER || '+14388016401',
    message:    buildLeadSMS(p),
  });
  results.steps.sms_lead = { status: smsLead.status, ok: smsLead.ok, detail: smsLead.ok ? undefined : smsLead.json };

  // 6. EMAIL LEAD
  const emailLead = await ghl(env, '/conversations/messages', 'POST', {
    type:      'Email',
    contactId,
    subject:   `Merci ${p['First name']} — nous avons bien reçu votre demande`,
    html:      buildLeadEmail(p),
    emailFrom: env.FROM_EMAIL,
  });
  results.steps.email_lead = { status: emailLead.status, ok: emailLead.ok };

  // 7. CONTACT INTERNE + NOTIFS
  const internalUpsert = await ghl(env, '/contacts/upsert', 'POST', {
    locationId: env.GHL_LOCATION_ID,
    firstName:  'Raycom',
    lastName:   'Interne',
    email:      env.INTERNAL_EMAIL,
    phone:      env.INTERNAL_PHONE,
    tags:       ['raycom-interne', 'do-not-contact'],
  });
  const internalId = internalUpsert.json.contact?.id || internalUpsert.json.id;
  results.steps.internal_upsert = { status: internalUpsert.status, ok: internalUpsert.ok };

  if (internalId) {
    const smsInt = await ghl(env, '/conversations/messages', 'POST', {
      type:       'SMS',
      contactId:  internalId,
      fromNumber: env.GHL_FROM_NUMBER || '+14388016401',
      message:    buildInternalSMS(p, oppValue),
    });
    results.steps.sms_internal = { status: smsInt.status, ok: smsInt.ok, detail: smsInt.ok ? undefined : smsInt.json };

    const emailInt = await ghl(env, '/conversations/messages', 'POST', {
      type:      'Email',
      contactId: internalId,
      subject:   `🔥 Lead ${oppValue.toLocaleString('fr-CA')} $ — ${p['First name']} ${p['Last name']} (${p.projet_segment})`,
      html:      buildInternalEmail(p, contactId, oppValue),
      emailFrom: env.FROM_EMAIL,
    });
    results.steps.email_internal = { status: emailInt.status, ok: emailInt.ok };
  }

  return new Response(
    JSON.stringify({ ok: true, ...results }),
    { status: 200, headers: { ...corsH, 'Content-Type': 'application/json' } }
  );
}

// ============================================================
//  HANDLER /sms — notification SMS générique (val.town Alex, etc.)
// ============================================================
async function handleSms(request, env) {
  const origin = request.headers.get('Origin') || '';
  const corsH  = cors(origin);

  // Auth simple par header partagé
  const auth = request.headers.get('X-Worker-Key') || '';
  if (env.WORKER_SHARED_KEY && auth !== env.WORKER_SHARED_KEY) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }),
      { status: 401, headers: { ...corsH, 'Content-Type': 'application/json' } });
  }

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ ok: false, error: 'bad_json' }),
    { status: 400, headers: { ...corsH, 'Content-Type': 'application/json' } }); }

  const to     = String(body.to || env.INTERNAL_PHONE || '').replace(/[^\d+]/g, '');
  const msg    = String(body.body || body.message || '').slice(0, 1500);
  const source = String(body.source || 'generic');

  if (!to || !msg) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_to_or_body' }),
      { status: 400, headers: { ...corsH, 'Content-Type': 'application/json' } });
  }

  // Upsert contact interne/notif — réutilise pattern handleSubmit
  const up = await ghl(env, '/contacts/upsert', 'POST', {
    locationId: env.GHL_LOCATION_ID,
    firstName:  'Raycom',
    lastName:   'Notif',
    phone:      to,
    tags:       ['raycom-interne', 'do-not-contact', `src-${source}`],
  });
  const contactId = up.json.contact?.id || up.json.id;
  if (!contactId) {
    return new Response(JSON.stringify({ ok: false, error: 'upsert_failed', detail: up.json }),
      { status: 502, headers: { ...corsH, 'Content-Type': 'application/json' } });
  }

  const sms = await ghl(env, '/conversations/messages', 'POST', {
    type:       'SMS',
    contactId,
    fromNumber: env.GHL_FROM_NUMBER || '+14388016401',
    message:    msg,
  });

  return new Response(
    JSON.stringify({ ok: sms.ok, status: sms.status, contactId, source, detail: sms.ok ? undefined : sms.json }),
    { status: sms.ok ? 200 : 502, headers: { ...corsH, 'Content-Type': 'application/json' } }
  );
}

// ============================================================
//  ROUTE PRINCIPALE
// ============================================================
export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const corsH  = cors(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsH });
    }

    if (request.method === 'POST' && url.pathname === '/submit') {
      try {
        return await handleSubmit(request, env);
      } catch (e) {
        return new Response(
          JSON.stringify({ error: 'worker_exception', message: String(e), stack: e.stack }),
          { status: 500, headers: { ...corsH, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (request.method === 'POST' && url.pathname === '/sms') {
      try {
        return await handleSms(request, env);
      } catch (e) {
        return new Response(
          JSON.stringify({ error: 'worker_exception', message: String(e), stack: e.stack }),
          { status: 500, headers: { ...corsH, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (url.pathname === '/health') {
      return new Response('Raycom Lead Proxy v3 OK', { status: 200, headers: corsH });
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404, headers: corsH });
  },
};
