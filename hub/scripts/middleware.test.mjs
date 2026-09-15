// Unit tests for the edge middleware. Env is read inside the handler, so each
// test can set process.env and share one imported module.
//
// Run: node --test scripts/middleware.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import middleware, { config } from '../middleware.js';

const PASSWORD = 'correct horse battery staple';
const SECRET = '9f2c1a4e7b3d5608f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708';
const SLUG = 'northwind';

function setEnv() {
  process.env.HUB_PASSWORD = PASSWORD;
  process.env.HUB_COOKIE_SECRET = SECRET;
  process.env.HUB_SLUG = SLUG;
}

function clearEnv() {
  delete process.env.HUB_PASSWORD;
  delete process.env.HUB_COOKIE_SECRET;
  delete process.env.HUB_SLUG;
}

const get = (path, cookie) =>
  new Request(`https://hub.example.com${path}`, {
    headers: cookie ? { cookie } : {},
  });

const postLogin = (password) => {
  const body = new URLSearchParams({ password });
  return new Request('https://hub.example.com/login', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
};

/** Runs a successful login and returns the `hub_session=...` cookie pair. */
async function loginCookie() {
  const res = await middleware(postLogin(PASSWORD));
  const setCookie = res.headers.get('set-cookie');
  return setCookie.split(';')[0];
}

test('matcher skips build assets and pre-session files', () => {
  assert.equal(config.matcher.length, 1);
  const re = new RegExp(`^${config.matcher[0]}$`);
  assert.ok(re.test('/'));
  assert.ok(re.test('/board'));
  assert.ok(!re.test('/_astro/index.abc123.css'));
  assert.ok(!re.test('/robots.txt'));
  assert.ok(!re.test('/favicon.svg'));
  assert.ok(!re.test('/logo.svg'));
  assert.ok(!re.test('/logo-on-dark.svg'));
  assert.ok(re.test('/logout'));
});

test('no cookie redirects to the login page', async () => {
  setEnv();
  const res = await middleware(get('/'));
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/login');
  assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(res.headers.get('set-cookie'), null);
});

test('GET /login and /login/ pass through', async () => {
  setEnv();
  assert.equal(await middleware(get('/login')), undefined);
  assert.equal(await middleware(get('/login/')), undefined);
});

test('POST with the wrong password bounces back with no cookie', async () => {
  setEnv();
  const res = await middleware(postLogin('not the password'));
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/login?e=1');
  assert.equal(res.headers.get('set-cookie'), null);
});

test('POST with the right password sets a hardened session cookie', async () => {
  setEnv();
  const res = await middleware(postLogin(PASSWORD));
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/');
  const cookie = res.headers.get('set-cookie');
  assert.match(cookie, /^hub_session=\d+\.[0-9a-f]{64};/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /Max-Age=2592000/);
});

test('a valid cookie passes through to the static file', async () => {
  setEnv();
  const cookie = await loginCookie();
  assert.equal(await middleware(get('/', cookie)), undefined);
  assert.equal(await middleware(get('/board', cookie)), undefined);
});

test('a tampered signature is rejected', async () => {
  setEnv();
  const cookie = await loginCookie();
  const flipped = cookie.slice(0, -1) + (cookie.endsWith('a') ? 'b' : 'a');
  const res = await middleware(get('/', flipped));
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/login');
});

test('a cookie signed for another hub slug is rejected', async () => {
  setEnv();
  const cookie = await loginCookie();
  process.env.HUB_SLUG = 'someone-else';
  const res = await middleware(get('/', cookie));
  assert.equal(res.status, 302);
  process.env.HUB_SLUG = SLUG;
});

test('an expired cookie is rejected even with a good signature', async () => {
  setEnv();
  const past = Date.now() - 1000;
  const { createHmac } = await import('node:crypto');
  const mac = createHmac('sha256', Buffer.from(SECRET, 'hex'))
    .update(`${SLUG}|${past}`)
    .digest('hex');
  const res = await middleware(get('/', `hub_session=${past}.${mac}`));
  assert.equal(res.status, 302);
});

test('GET /logout does not clear the cookie', async () => {
  setEnv();
  const res = await middleware(get('/logout'));
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/');
  assert.equal(res.headers.get('set-cookie'), null);
});

test('logout clears the cookie', async () => {
  setEnv();
  const res = await middleware(new Request('https://hub.example.com/logout', { method: 'POST' }));
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/login');
  assert.match(res.headers.get('set-cookie'), /^hub_session=;/);
  assert.match(res.headers.get('set-cookie'), /Max-Age=0/);
});

test('missing env returns 500 without echoing anything', async () => {
  clearEnv();
  const res = await middleware(get('/'));
  assert.equal(res.status, 500);
  assert.equal(await res.text(), 'Hub is not configured.');
  assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
  setEnv();
});
