// Acuity booking -> Kit form bridge.
//
// Acuity's "Custom conversion tracking" snippet (automation/acuity-conversion-snippet.html)
// beacons here from the booking confirmation page. This function adds the registrant to the
// Kit form mapped to the Acuity appointment type. Existing Kit automations (tag + welcome
// sequence) fire on "joins form" exactly as they did on the Zapier path.
//
// Env vars (set with `vercel env add ... production` and `... preview` from workshop/):
//   KIT_API_KEY          Kit v4 API key (Kit -> Settings -> Developer)
//   ACUITY_BEACON_TOKEN  shared token pasted into the Acuity snippet
//
// Probe mode: when ACUITY_BEACON_TOKEN is unset, every request is logged with outcome
// "probe" and nothing is sent to Kit. Used once to confirm the Acuity frame can reach us.
//
// Monthly: add one line to FORMS for the new workshop (exact Acuity appointment type name,
// lowercased, whitespace collapsed) -> Kit form id. Then `vercel --prod`.

import { timingSafeEqual } from 'node:crypto';

const FORMS = {
  'zz test class (ignore)': 0, // scratch Kit form for testing; set id, remove after rollout
  // 'calm before commands': 0, // Sept 27 2026 online workshop; exact type name + form id from Pam
};

const KIT = 'https://api.kit.com/v4';
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const clean = (s, max = 80) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

function tokenOk(given) {
  const a = Buffer.from(String(given ?? ''));
  const b = Buffer.from(process.env.ACUITY_BEACON_TOKEN ?? '');
  return b.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

async function kit(method, path, body) {
  const r = await fetch(KIT + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Kit-Api-Key': process.env.KIT_API_KEY ?? '' },
    body: JSON.stringify(body),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`kit ${method} ${path} -> ${r.status} ${JSON.stringify(json).slice(0, 300)}`);
  return { status: r.status, json };
}

function done(outcome, extra = {}) {
  console.log(JSON.stringify({ evt: 'acuity-kit', outcome, ...extra }));
  return new Response(null, { status: 204 });
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (request.method !== 'POST') return new Response(null, { status: 405 });

    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');

    let p;
    try {
      p = JSON.parse(await request.text());
    } catch {
      return done('bad-json', { origin, referer });
    }

    if (!process.env.ACUITY_BEACON_TOKEN) {
      return done('probe', {
        origin,
        referer,
        kind: norm(p.kind),
        appointmentType: clean(p.appointmentType),
        email: clean(p.email, 254),
        appointmentId: clean(p.appointmentId, 20),
        clientDate: clean(p.clientDate),
        clientTime: clean(p.clientTime),
      });
    }

    if (!tokenOk(p.token)) return done('bad-token', { origin, referer });

    const email = clean(p.email, 254).toLowerCase();
    if (!EMAIL_RE.test(email)) return done('bad-email', { origin });

    const typeName = norm(p.appointmentType);
    const formId = FORMS[typeName];
    if (!formId) return done('skip-unmapped', { typeName, kind: norm(p.kind), origin });

    const fields = {
      date_of_online_class: clean(p.clientDate),
      time_of_online_class: clean(p.clientTime),
    };

    try {
      const created = await kit('POST', '/subscribers', { email_address: email, fields });
      const sub = created.json.subscriber;
      if (!sub?.id) throw new Error(`kit POST /subscribers returned no subscriber: ${JSON.stringify(created.json).slice(0, 300)}`);
      if (created.status === 200) await kit('PUT', `/subscribers/${sub.id}`, { email_address: email, fields });
      const added = await kit('POST', `/forms/${formId}/subscribers/${sub.id}`, {
        referrer: 'https://workshop.down4paws.com/?src=acuity',
      });
      return done(added.status === 201 ? 'added' : 'already', {
        email,
        formId,
        subscriberId: sub.id,
        state: sub.state,
        appointmentId: clean(p.appointmentId, 20),
        origin,
      });
    } catch (err) {
      console.error(JSON.stringify({ evt: 'acuity-kit', outcome: 'error', email, formId, message: err.message }));
      return new Response(null, { status: 500 });
    }
  },
};
