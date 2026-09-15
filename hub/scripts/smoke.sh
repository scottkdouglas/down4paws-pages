#!/usr/bin/env bash
# Post-deploy smoke test for the hub gate.
#
# Usage: scripts/smoke.sh https://client-hub.vercel.app 'the-password'
#
# Checks the gate from the outside: an unauthenticated visitor cannot reach a
# page, a wrong password mints nothing, a right password mints a hardened
# cookie, a tampered cookie is refused, and the site is not indexable.

set -u

BASE="${1:-}"
PASSWORD="${2:-}"

if [ -z "$BASE" ] || [ -z "$PASSWORD" ]; then
  echo "usage: $0 <base_url> <password>" >&2
  exit 2
fi

BASE="${BASE%/}"
FAILURES=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass() { printf 'PASS  %s\n' "$1"; }
fail() { printf 'FAIL  %s\n       %s\n' "$1" "$2"; FAILURES=$((FAILURES + 1)); }

check() {
  # check <name> <condition-result> <detail>
  if [ "$2" = "yes" ]; then pass "$1"; else fail "$1" "$3"; fi
}

# Header lookups are case-insensitive because HTTP/2 lowercases header names.
header() { grep -i "^$1:" "$2" | tail -1 | tr -d '\r'; }

# --- 1. root without a cookie redirects to the login page ---------------------
code=$(curl -sS -o /dev/null -D "$TMP/h1" -w '%{http_code}' "$BASE/")
loc=$(header 'location' "$TMP/h1")
if [ "$code" = "302" ] && printf '%s' "$loc" | grep -qi '/login'; then
  check "/ without cookie is 302 to /login" yes ""
else
  check "/ without cookie is 302 to /login" no "got $code ${loc:-no location}"
fi

# --- 2. the login page itself is reachable, noindex, and not cached -----------
# -L is used here because a host may normalise /login to /login/ first; the
# final response is the one that must be 200.
code=$(curl -sS -L --max-redirs 3 -o "$TMP/b2" -D "$TMP/h2" -w '%{http_code}' "$BASE/login")
robots=$(header 'x-robots-tag' "$TMP/h2")
if [ "$code" = "200" ]; then
  check "/login is 200" yes ""
else
  check "/login is 200" no "got $code"
fi
if printf '%s' "$robots" | grep -qi 'noindex'; then
  check "/login sends x-robots-tag: noindex" yes ""
else
  check "/login sends x-robots-tag: noindex" no "got '${robots:-none}'"
fi
if grep -q 'content="noindex' "$TMP/b2"; then
  check "/login body carries the noindex meta tag" yes ""
else
  check "/login body carries the noindex meta tag" no "meta tag not found"
fi

# --- 3. wrong password mints nothing -----------------------------------------
code=$(curl -sS -o /dev/null -D "$TMP/h3" -w '%{http_code}' \
  --data-urlencode "password=definitely-not-the-password" "$BASE/login")
loc=$(header 'location' "$TMP/h3")
setc=$(header 'set-cookie' "$TMP/h3")
if [ "$code" = "303" ] && printf '%s' "$loc" | grep -q '/login?e=1'; then
  check "POST wrong password is 303 to /login?e=1" yes ""
else
  check "POST wrong password is 303 to /login?e=1" no "got $code ${loc:-no location}"
fi
if [ -z "$setc" ]; then
  check "POST wrong password sets no cookie" yes ""
else
  check "POST wrong password sets no cookie" no "got a set-cookie header"
fi

# --- 4. right password mints a hardened cookie -------------------------------
code=$(curl -sS -o /dev/null -D "$TMP/h4" -w '%{http_code}' \
  --data-urlencode "password=$PASSWORD" "$BASE/login")
loc=$(header 'location' "$TMP/h4")
setc=$(header 'set-cookie' "$TMP/h4")
# Accept either a relative "/" or an absolutised "https://host/".
dest=$(printf '%s' "$loc" | sed 's/^[Ll]ocation: *//')
dest="${dest#"$BASE"}"
if [ "$code" = "303" ] && { [ "$dest" = "/" ] || [ -z "$dest" ]; }; then
  check "POST right password is 303 to /" yes ""
else
  check "POST right password is 303 to /" no "got $code ${loc:-no location}"
fi
if printf '%s' "$setc" | grep -q 'HttpOnly' && printf '%s' "$setc" | grep -q 'Secure'; then
  check "session cookie is HttpOnly and Secure" yes ""
else
  check "session cookie is HttpOnly and Secure" no "got '${setc:-none}'"
fi

COOKIE=$(printf '%s' "$setc" | sed 's/^[Ss]et-[Cc]ookie: *//' | cut -d';' -f1)
if [ -z "$COOKIE" ]; then
  fail "session cookie captured" "no cookie to test the authenticated paths with"
  printf '\n%s check(s) failed.\n' "$FAILURES"
  exit 1
fi

# --- 5. the cookie opens the hub ---------------------------------------------
code=$(curl -sS -o /dev/null -w '%{http_code}' -H "Cookie: $COOKIE" "$BASE/")
if [ "$code" = "200" ]; then
  check "/ with a valid cookie is 200" yes ""
else
  check "/ with a valid cookie is 200" no "got $code"
fi

# --- 6. a tampered cookie does not ------------------------------------------
# Flip the last character of the signature so the HMAC no longer matches.
LAST="${COOKIE#"${COOKIE%?}"}"
if [ "$LAST" = "a" ]; then REPL="b"; else REPL="a"; fi
TAMPERED="${COOKIE%?}$REPL"
code=$(curl -sS -o /dev/null -w '%{http_code}' -H "Cookie: $TAMPERED" "$BASE/")
if [ "$code" = "302" ]; then
  check "tampered cookie is 302 back to /login" yes ""
else
  check "tampered cookie is 302 back to /login" no "got $code"
fi

# --- 7. robots.txt is public and closed --------------------------------------
code=$(curl -sS -o "$TMP/b7" -w '%{http_code}' "$BASE/robots.txt")
if [ "$code" = "200" ] && grep -q 'Disallow: /' "$TMP/b7"; then
  check "/robots.txt is 200 and disallows everything" yes ""
else
  check "/robots.txt is 200 and disallows everything" no "got $code"
fi

# --- 8. no sitemap is published ----------------------------------------------
code=$(curl -sS -o /dev/null -w '%{http_code}' -H "Cookie: $COOKIE" "$BASE/sitemap-index.xml")
if [ "$code" = "404" ]; then
  check "/sitemap-index.xml is 404" yes ""
else
  check "/sitemap-index.xml is 404" no "got $code"
fi

printf '\n'
if [ "$FAILURES" -gt 0 ]; then
  printf '%s check(s) failed.\n' "$FAILURES"
  exit 1
fi
printf 'All checks passed.\n'
