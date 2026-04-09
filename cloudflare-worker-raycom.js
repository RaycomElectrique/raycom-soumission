// ============================================================
//  RAYCOM LEAD PROXY — Cloudflare Worker v3
//  Reçoit les POST du formulaire GitHub Pages et orchestre GHL
// ============================================================
//  Secrets Cloudflare (Settings → Variables) :
//    GHL_TOKEN              Bearer PIT (pit-xxxxx)
//    GHL_LOCATION_ID        Ey6SB5epk8GFGgL5BfhX
//    GHL_PIPELINE_ID        iXxbCQTd0UOm3AMcRxIQ
//    GHL_STAGE_ID           7ad5fc70-eadb-4929-b92e-07a7fa667b0f
//    INTERNAL_PHONE         +15143533600
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
  if (hasSolaire && hasBatterie) total += 5000;

  return Math.round((total * multSeg) / 500) * 500;
}

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

function buildLeadSMS(p) {
  return `Bonjour ${p['First name']}, c'est Raycom Électrique. On a bien reçu votre demande pour votre projet ${p.projet_composantes_str || p.projet_nature}. On vous contacte sous 24h ouvrables. — Jean-François`;
}

function buildInternalSMS(p, oppValue) {
  const val = oppValue ? `~${Math.round(oppValue / 1000)}k$` : '';
  return `🔥 ${p['First name']} ${p['Last name']} ${val} — ${p.projet_composantes_str || p.projet_nature}. ${p.Phone}. ${p.City}`;
}

function buildLeadEmail(p) {
  const val = p.budget_estime ? `${Number(p.budget_estime).toLocaleString('fr-CA')} $` : null;
  return `<div style="font-family:Arial,sans-serif;color:#1a1a1a;font-size:14px;"><p>Bonjour ${html(p['First name'])},</p><p>Merci d’avoir soumis votre demande à <strong>Raycom Électrique</strong>. Notre équipe vous contactera sous <strong>24h ouvrables</strong>.</p>${val ? `<p><strong>Budget estimé :</strong> <span style="color:#1B5DC8;font-weight:700;">${html(val)}</span></p>` : ''}<p>— L’équipe Raycom Électrique</p></div>`;
}

function buildInternalEmail(p, contactId, oppValue) {
  const valFmt = oppValue ? `${oppValue.toLocaleString('fr-CA')} $` : 'N/A';
  return `<h2>🔥 Nouveau lead — ${html(p.projet_segment)}</h2><p><strong>${html(p['First name'])} ${html(p['Last name'])}</strong> — ${html(p.Phone)}</p><p><strong>Valeur :</strong> ${html(valFmt)}</p><p><a href="https://app.gohighlevel.com/v2/location/${html(p._locationId)}/contacts/detail/${html(contactId)}">→ Ouvrir dans GHL</a></p>`;
}

async function handleSubmit(request, env) {
  const origin = request.headers.get('Origin') || '';
  const corsH  = cors(origin);
  const p      = await request.json();
  p._locationId = env.GHL_LOCATION_ID;

  const results = { steps: {} };

  const oppValue = p.budget_estime
    ? parseInt(p.budget_estime, 10)
    : calculateOpportunityValue(p);
  results.oppValue = oppValue;

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

  const noteLines = [
    '=== Projet ===',
    `Segment: ${p.projet_segment || ''}`,
    `Nature: ${p.projet_nature || ''}`,
    `Composantes: ${p.projet_composantes_str || ''}`,
    `Conso HQ: ${p.hq_consommation_bracket || ''}`,
    `Valeur estimée: ${oppValue.toLocaleString('fr-CA')} $`,
    '',
    p.projet_notes || '(aucune)',
    `Soumis: ${p.submitted_at || new Date().toISOString()}`,
  ].filter(Boolean).join('\n');

  const note = await ghl(env, `/contacts/${contactId}/notes`, 'POST', { body: noteLines });
  results.steps.note = { status: note.status, ok: note.ok };

  const assignedUserId = await getAssignedUserId(env);
  results.assignedUserId = assignedUserId;

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

  const smsLead = await ghl(env, '/conversations/messages', 'POST', {
    type:       'SMS',
    contactId,
    fromNumber: env.GHL_FROM_NUMBER || '+14388016401',
    message:    buildLeadSMS(p),
  });
  results.steps.sms_lead = { status: smsLead.status, ok: smsLead.ok, detail: smsLead.ok ? undefined : smsLead.json };

  const emailLead = await ghl(env, '/conversations/messages', 'POST', {
    type:      'Email',
    contactId,
    subject:   `Merci ${p['First name']} — nous avons bien reçu votre demande`,
    html:      buildLeadEmail(p),
    emailFrom: env.FROM_EMAIL,
  });
  results.steps.email_lead = { status: emailLead.status, ok: emailLead.ok };

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

    if (url.pathname === '/health') {
      return new Response('Raycom Lead Proxy v3 OK', { status: 200, headers: corsH });
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404, headers: corsH });
  },
};
