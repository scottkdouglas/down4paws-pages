// Acuity booking -> Kit tag (+ optional sequence) bridge.
//
// Acuity's "Custom conversion tracking" snippet (automation/acuity-conversion-snippet.html)
// beacons here from the booking confirmation page. This function upserts the registrant in
// Kit, applies the tag mapped to the Acuity appointment type, and (if a sequenceId is set)
// adds them to the welcome sequence. A Kit Visual Automation triggered by the tag can do the
// sequence step instead; leave sequenceId out in that case.
//
// Env vars (set with `vercel env add ... production` and `... preview` from workshop/):
//   KIT_API_KEY          Kit v4 API key (Kit -> Settings -> Developer)
//   ACUITY_BEACON_TOKEN  shared token pasted into the Acuity snippet
//
//   ACUITY_PROBE_MODE    "true" on PREVIEW only: log every request as outcome "probe", never call Kit.
//                        Used once to confirm the Acuity frame can reach us. Never set on production.
//                        With the token unset and probe mode off, the function fails closed ("no-token").
//
// Monthly: add one line to TARGETS for the new workshop (exact Acuity appointment type name,
// lowercased, whitespace collapsed) -> { tagId, sequenceId? }. Then `vercel --prod`.

import { timingSafeEqual } from 'node:crypto';

const TARGETS = {
  'zz test class (ignore)': { tagId: 23056184, sequenceId: 2881955 },                 // "ZZ Test - Acuity Bridge", remove after rollout
  'calm before commands (online workshop)': { tagId: 23056186, sequenceId: 2881955 }, // Sept 27 2026 welcome sequence
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
    if (!p || typeof p !== 'object' || Array.isArray(p)) return done('bad-payload', { origin, referer });

    if (process.env.ACUITY_PROBE_MODE === 'true') {
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

    if (!process.env.ACUITY_BEACON_TOKEN) return done('no-token', { origin, referer });
    if (!tokenOk(p.token)) return done('bad-token', { origin, referer });

    const email = clean(p.email, 254).toLowerCase();
    if (!EMAIL_RE.test(email)) return done('bad-email', { origin });

    const typeName = norm(p.appointmentType);
    const target = TARGETS[typeName];
    if (!target?.tagId) return done('skip-unmapped', { typeName, kind: norm(p.kind), origin });

    // Acuity sends "11:00am EDT"; the Zap wrote "7:00pm". Strip the zone so templates match.
    const fields = {
      date_of_online_class: clean(p.clientDate),
      time_of_online_class: clean(p.clientTime).replace(/\s+[A-Z]{2,5}$/, ''),
    };

    try {
      const created = await kit('POST', '/subscribers', { email_address: email, fields });
      const sub = created.json.subscriber;
      if (!sub?.id) throw new Error(`kit POST /subscribers returned no subscriber: ${JSON.stringify(created.json).slice(0, 300)}`);
      if (created.status === 200) await kit('PUT', `/subscribers/${sub.id}`, { email_address: email, fields });
      const tagged = await kit('POST', `/tags/${target.tagId}/subscribers/${sub.id}`, {});
      let sequenceStatus = null;
      if (target.sequenceId) {
        const seq = await kit('POST', `/sequences/${target.sequenceId}/subscribers/${sub.id}`, {});
        sequenceStatus = seq.status;
      }
      return done(tagged.status === 201 ? 'added' : 'already', {
        email,
        tagId: target.tagId,
        sequenceId: target.sequenceId ?? null,
        sequenceStatus,
        subscriberId: sub.id,
        state: sub.state,
        appointmentId: clean(p.appointmentId, 20),
        origin,
      });
    } catch (err) {
      console.error(JSON.stringify({ evt: 'acuity-kit', outcome: 'error', email, tagId: target.tagId, message: err.message }));
      return new Response(null, { status: 500 });
    }
  },
};
