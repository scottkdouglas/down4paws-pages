// Vercel Edge Middleware: password gate for a private, single-client hub.
//
// Runs in front of the static build, so an unauthenticated request never
// reaches a generated HTML file. Web APIs only, no npm deps.

const COOKIE_NAME = 'hub_session';
const MAX_AGE_SECONDS = 2592000; // 30 days
const NOINDEX = 'noindex, nofollow';

// Everything is gated except the build assets and the files a browser or
// crawler fetches before it could ever hold a session.
export const config = {
  matcher: ['/((?!_astro/|robots\\.txt|favicon\\.|logo[-\\w]*\\.).*)'],
};

const enc = new TextEncoder();

/** Hex string to bytes. Falls back to UTF-8 if the secret was not set as hex. */
function keyBytes(secret) {
  if (secret.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(secret)) {
    const out = new Uint8Array(secret.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(secret.slice(i * 2, i * 2 + 2), 16);
    return out;
  }
  return enc.encode(secret);
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Compares in time proportional to the expected value only. A length mismatch
// still runs a full pass against a dummy so the reject path costs the same.
function timingSafeEqual(a, b) {
  const x = enc.encode(a);
  const y = enc.encode(b);
  const same = x.length === y.length;
  const probe = same ? y : new Uint8Array(x.length);
  let diff = same ? 0 : 1;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ probe[i];
  return diff === 0;
}

function sign(expiresMs, slug, secret) {
  return hmacHex(secret, `${slug}|${expiresMs}`);
}

async function isValidCookie(value, slug, secret) {
  if (!value) return false;
  const dot = value.indexOf('.');
  if (dot < 1) return false;
  const expiresMs = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  if (!/^\d+$/.test(expiresMs)) return false;
  // Expiry is checked before the compare: an expired cookie is rejected even if
  // its signature is perfect, so a stolen cookie has a hard ceiling.
  if (Number(expiresMs) <= Date.now()) return false;
  return timingSafeEqual(mac, await sign(expiresMs, slug, secret));
}

function readCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return '';
}

function redirect(location, status, cookie) {
  const headers = new Headers({ Location: location, 'X-Robots-Tag': NOINDEX });
  if (cookie) headers.append('Set-Cookie', cookie);
  return new Response(null, { status, headers });
}

export default async function middleware(request) {
  try {
    return await handle(request);
  } catch {
    // Fail closed with the same generic response as a misconfigured hub.
    return new Response('Hub is not configured.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': NOINDEX },
    });
  }
}

async function handle(request) {
  const password = process.env.HUB_PASSWORD;
  const secret = process.env.HUB_COOKIE_SECRET;
  const slug = process.env.HUB_SLUG;

  // Fail closed and say nothing useful. Never echo an env value.
  if (!password || !secret || !slug) {
    return new Response('Hub is not configured.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': NOINDEX },
    });
  }

  const url = new URL(request.url);
  const path =
    url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;

  if (path === '/login') {
    if (request.method === 'POST') {
      let submitted = '';
      try {
        const form = await request.formData();
        submitted = String(form.get('password') ?? '');
      } catch {
        // Not a form post. Treat it as a failed attempt rather than a 500.
      }
      if (!timingSafeEqual(submitted, password)) {
        return redirect('/login?e=1', 303);
      }
      const expiresMs = Date.now() + MAX_AGE_SECONDS * 1000;
      const value = `${expiresMs}.${await sign(expiresMs, slug, secret)}`;
      // HttpOnly keeps the token out of JS, Secure keeps it off plain HTTP, and
      // SameSite=Lax still allows the top-level POST from this same origin.
      const cookie =
        `${COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE_SECONDS}`;
      return redirect('/', 303, cookie);
    }
    return; // serve the static login page
  }

  if (path === '/logout') {
    // Logout is a POST so another site cannot clear the session with an <img> tag.
    if (request.method !== 'POST') return redirect('/', 303);
    const cleared = `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
    return redirect('/login', 303, cleared);
  }

  if (await isValidCookie(readCookie(request, COOKIE_NAME), slug, secret)) {
    return; // serve the static file
  }

  return redirect('/login', 302);
}
