// ============================================================
//  RAYCOM LEAD PROXY — Cloudflare Worker
//  Reçoit les POST du formulaire GitHub Pages et orchestre GHL
// ============================================================
//  Secrets à configurer dans Cloudflare (Settings → Variables):
//    GHL_TOKEN              (Bearer PIT, ex: pit-xxxxx)
//    GHL_LOCATION_ID        (Ey6SB5epk8GFGgL5BfhX)
//    GHL_PIPELINE_ID        (iXxbCQTd0UOm3AMcRxIQ)
//    GHL_STAGE_ID           (7ad5fc70-eadb-4929-b92e-07a7fa667b0f)
//    INTERNAL_PHONE         (+15145551234  - ton cell Raycom)
//    INTERNAL_EMAIL         (info@raycomelectrique.com)
//    FROM_EMAIL             (info@raycomelectrique.com)
// ============================================================

const ALLOWED_ORIGINS = [
  'https://raycomelectrique.github.io',
  'https://raycomelectrique.com',
  'https://www.raycomelectrique.com',
  'https://soumission.raycomelectrique.com',
  'https://raycom-soumission.proud-leaf-b313.workers.dev',
];

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';

function cors(origin) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : '*';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

async function ghl(env, path, method = 'GET', body) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${env.GHL_TOKEN}`,
      'Version': GHL_VERSION,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json };
}

function html(t){return (t==null?'':String(t)).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

function buildLeadEmail(p) {
  return `
<p>Bonjour ${html(p['First name'])},</p>
<p>Merci d'avoir soumis votre demande à <strong>Raycom Électrique</strong>. Notre équipe a bien reçu les détails de votre projet <strong>${html(p.projet_nature)}</strong> et vous contactera dans les <strong>24 heures ouvrables</strong>.</p>
<p><strong>Résumé de votre demande :</strong><br>
• Segment : ${html(p.projet_segment)}<br>
• Composantes : ${html(p.projet_composantes_str)}<br>
• Consommation HQ : ${html(p.hq_consommation_bracket)}</p>
<p>Une question d'ici là ? Répondez directement à ce courriel ou appelez-nous.</p>
<p>— L'équipe Raycom Électrique<br>
Maître électricien agréé | RBQ 5830-1275-01<br>
<a href="https://raycomelectrique.com">raycomelectrique.com</a></p>`;
}

function buildLeadSMS(p) {
  return `Bonjour ${p['First name']}, c'est Raycom Électrique. On a bien reçu votre demande pour votre projet ${p.projet_nature}. On vous contacte sous 24h ouvrables. — Jean-François`;
}

function buildInternalEmail(p, contactId) {
  return `
<h2>🔥 Nouveau lead — ${html(p.projet_segment)} / ${html(p.projet_nature)}</h2>
<p><strong>${html(p['First name'])} ${html(p['Last name'])}</strong></p>
<table cellpadding="4" style="border-collapse:collapse">
<tr><td><b>Email</b></td><td>${html(p.Email)}</td></tr>
<tr><td><b>Téléphone</b></td><td>${html(p.Phone)}</td></tr>
<tr><td><b>Adresse</b></td><td>${html(p.Address)}, ${html(p.City)}, ${html(p.State)} ${html(p['Postal code'])}</td></tr>
<tr><td><b>Segment</b></td><td>${html(p.projet_segment)}</td></tr>
<tr><td><b>Nature</b></td><td>${html(p.projet_nature)}</td></tr>
<tr><td><b>Composantes</b></td><td>${html(p.projet_composantes_str)}</td></tr>
<tr><td><b>Consommation HQ</b></td><td>${html(p.hq_consommation_bracket)}</td></tr>
<tr><td><b>Notes</b></td><td>${html(p.projet_notes)}</td></tr>
</table>
<h3>Documents</h3>
<ul>
${p.doc_facture_hq?`<li>Facture HQ : <a href="${html(p.doc_facture_hq)}">${html(p.doc_facture_hq)}</a></li>`:''}
${p.photos_panneau?`<li>Photos panneau : ${html(p.photos_panneau)}</li>`:''}
${p.photos_compteur?`<li>Photos compteur : ${html(p.photos_compteur)}</li>`:''}
${p.photos_emplacement?`<li>Photos emplacement : ${html(p.photos_emplacement)}</li>`:''}
${p.doc_plans?`<li>Plans : <a href="${html(p.doc_plans)}">${html(p.doc_plans)}</a></li>`:''}
${p.doc_autres?`<li>Autres : ${html(p.doc_autres)}</li>`:''}
</ul>
<p><a href="https://app.gohighlevel.com/v2/location/${html(p._locationId)}/contacts/detail/${html(contactId)}">→ Ouvrir dans GHL</a></p>`;
}

function buildInternalSMS(p) {
  return `🔥 Lead ${p['First name']} ${p['Last name']} — ${p.projet_segment}/${p.projet_nature}. ${p.Phone}. ${p.City}`;
}

async function handleSubmit(request, env) {
  const origin = request.headers.get('Origin') || '';
  const corsH = cors(origin);
  const p = await request.json();
  p._locationId = env.GHL_LOCATION_ID;

  const results = { steps: {} };

  // 1. UPSERT CONTACT
  const tags = [
    p.projet_segment && `segment:${p.projet_segment}`,
    p.projet_nature && `nature:${p.projet_nature}`,
    'source:formulaire-web',
  ].filter(Boolean);

  const upsert = await ghl(env, '/contacts/upsert', 'POST', {
    locationId: env.GHL_LOCATION_ID,
    firstName: p['First name'],
    lastName: p['Last name'],
    email: p.Email,
    phone: p.Phone,
    address1: p.Address,
    city: p.City,
    state: p.State,
    postalCode: p['Postal code'],
    country: p.Country || 'CA',
    source: p.source || 'Formulaire web',
    tags,
  });
  results.steps.upsert = { status: upsert.status, ok: upsert.ok };
  if (!upsert.ok) {
    return new Response(JSON.stringify({ error: 'upsert_failed', detail: upsert.json }), { status: 500, headers: { ...corsH, 'Content-Type': 'application/json' }});
  }
  const contactId = upsert.json.contact?.id || upsert.json.id;
  results.contactId = contactId;

  // 2. ADD NOTE (projet details + doc URLs)
  const noteBody = [
    `=== Projet ===`,
    `Segment: ${p.projet_segment || ''}`,
    `Nature: ${p.projet_nature || ''}`,
    `Composantes: ${p.projet_composantes_str || ''}`,
    `Consommation HQ: ${p.hq_consommation_bracket || ''}`,
    ``,
    `=== Notes client ===`,
    p.projet_notes || '(aucune)',
    ``,
    `=== Documents ===`,
    p.doc_facture_hq ? `Facture HQ: ${p.doc_facture_hq}` : null,
    p.photos_panneau ? `Photos panneau: ${p.photos_panneau}` : null,
    p.photos_compteur ? `Photos compteur: ${p.photos_compteur}` : null,
    p.photos_emplacement ? `Photos emplacement: ${p.photos_emplacement}` : null,
    p.doc_plans ? `Plans: ${p.doc_plans}` : null,
    p.doc_autres ? `Autres: ${p.doc_autres}` : null,
    ``,
    `Soumis: ${p.submitted_at || new Date().toISOString()}`,
  ].filter(Boolean).join('\n');

  const note = await ghl(env, `/contacts/${contactId}/notes`, 'POST', { body: noteBody });
  results.steps.note = { status: note.status, ok: note.ok };

  // 3. CREATE OPPORTUNITY
  const opp = await ghl(env, '/opportunities/', 'POST', {
    locationId: env.GHL_LOCATION_ID,
    pipelineId: env.GHL_PIPELINE_ID,
    pipelineStageId: env.GHL_STAGE_ID,
    name: `${p['First name']} ${p['Last name']} - ${p.projet_segment || 'Lead'}`,
    status: 'open',
    contactId,
    source: p.source || 'Formulaire web',
    monetaryValue: 0,
  });
  results.steps.opportunity = { status: opp.status, ok: opp.ok };

  // 4. SMS au lead
  const smsLead = await ghl(env, '/conversations/messages', 'POST', {
    type: 'SMS',
    contactId,
    message: buildLeadSMS(p),
  });
  results.steps.sms_lead = { status: smsLead.status, ok: smsLead.ok };

  // 5. Email au lead
  const emailLead = await ghl(env, '/conversations/messages', 'POST', {
    type: 'Email',
    contactId,
    subject: `Merci ${p['First name']} — nous avons bien reçu votre demande`,
    html: buildLeadEmail(p),
    emailFrom: env.FROM_EMAIL,
  });
  results.steps.email_lead = { status: emailLead.status, ok: emailLead.ok };

  // 6. SMS interne (à JF) — envoyé au contact interne "Raycom Admin" si existe,
  //    sinon via Twilio direct. Pour v1: on utilise un contact interne créé une fois.
  //    Fallback simple: crée/maj un contact "Raycom Interne" et envoie-lui SMS+Email.
  const internalUpsert = await ghl(env, '/contacts/upsert', 'POST', {
    locationId: env.GHL_LOCATION_ID,
    firstName: 'Raycom',
    lastName: 'Interne',
    email: env.INTERNAL_EMAIL,
    phone: env.INTERNAL_PHONE,
    tags: ['raycom-interne', 'do-not-contact'],
  });
  const internalId = internalUpsert.json.contact?.id || internalUpsert.json.id;
  results.steps.internal_upsert = { status: internalUpsert.status, ok: internalUpsert.ok };

  if (internalId) {
    const smsInt = await ghl(env, '/conversations/messages', 'POST', {
      type: 'SMS',
      contactId: internalId,
      message: buildInternalSMS(p),
    });
    results.steps.sms_internal = { status: smsInt.status, ok: smsInt.ok };

    const emailInt = await ghl(env, '/conversations/messages', 'POST', {
      type: 'Email',
      contactId: internalId,
      subject: `🔥 Nouveau lead ${p.projet_segment} — ${p['First name']} ${p['Last name']}`,
      html: buildInternalEmail(p, contactId),
      emailFrom: env.FROM_EMAIL,
    });
    results.steps.email_internal = { status: emailInt.status, ok: emailInt.ok };
  }

  return new Response(JSON.stringify({ ok: true, ...results }), {
    status: 200,
    headers: { ...corsH, 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const corsH = cors(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsH });
    }

    if (request.method === 'POST' && url.pathname === '/submit') {
      try {
        return await handleSubmit(request, env);
      } catch (e) {
        return new Response(JSON.stringify({ error: 'worker_exception', message: String(e), stack: e.stack }), {
          status: 500,
          headers: { ...corsH, 'Content-Type': 'application/json' },
        });
      }
    }

    if (url.pathname === '/health') {
      return new Response('Raycom Lead Proxy OK', { status: 200, headers: corsH });
    }

    // Fallback → static assets (index.html, images, etc.)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response('Not found', { status: 404, headers: corsH });
  },
};
