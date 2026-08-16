#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  Smoke test API – prejde hlavný scenár: registrácia → skriňa → šuplík →
#  zložka → dokument → revízia → hľadanie → zdieľanie.
#
#  Spustenie (lokálny docker):
#      docker exec mdcabinet-app bash bin/smoke-test.sh
#  alebo proti ľubovoľnej inštancii:
#      BASE=https://docs.mojadomena.sk bin/smoke-test.sh
# ---------------------------------------------------------------------------
set -uo pipefail

BASE="${BASE:-http://localhost}"
JAR="$(mktemp)"
REQ="$(mktemp)"
OUT="$(mktemp)"
EMAIL="smoke+$(date +%s)@mdcabinet.test"
PASS="tajneheslo123"

pass=0
fail=0

cleanup() { rm -f "$JAR" "$REQ" "$OUT"; }
trap cleanup EXIT

# call <METHOD> <PATH> [JSON body] -> nastaví BODY a CODE
#
# Telo ide cez súbor a --data-binary: na Windows (Git Bash) by curl.exe
# prepísal UTF-8 argumenty do systémovej kódovej stránky a diakritika
# by dorazila rozbitá.
call() {
  local method="$1" path="$2" body="${3:-}"
  local args=(-s -o "$OUT" -w '%{http_code}' -X "$method"
              -b "$JAR" -c "$JAR" -H 'Accept: application/json')
  [ -n "${CSRF:-}" ] && args+=(-H "X-CSRF-Token: $CSRF")
  if [ -n "$body" ]; then
    printf '%s' "$body" > "$REQ"
    args+=(-H 'Content-Type: application/json' --data-binary "@$REQ")
  fi
  CODE="$(curl "${args[@]}" "$BASE$path")"
  BODY="$(cat "$OUT")"
}

check() {
  local label="$1" expected="$2"
  if [ "$CODE" = "$expected" ]; then
    printf '  \033[32m✓\033[0m %-46s %s\n' "$label" "$CODE"
    pass=$((pass + 1))
  else
    printf '  \033[31m✗\033[0m %-46s %s (čakal %s)\n' "$label" "$CODE" "$expected"
    printf '      %s\n' "$(echo "$BODY" | head -c 400)"
    fail=$((fail + 1))
  fi
}

# json_get <kľúč> – vytiahne prvú hodnotu kľúča z BODY (čísla aj reťazce)
json_get() {
  echo "$BODY" | grep -o "\"$1\":[^,}]*" | head -1 | sed 's/.*://; s/^"//; s/"$//'
}

echo "MDcabinet smoke test → $BASE"
echo

echo "── Inštalácia a účet ──────────────────────────────────────────────"
call GET /api/setup/status
check "GET  /api/setup/status" 200

call POST /api/auth/register "{\"email\":\"$EMAIL\",\"name\":\"Smoke Test\",\"password\":\"$PASS\"}"
check "POST /api/auth/register" 201
CSRF="$(json_get csrf)"

call GET /api/auth/me
check "GET  /api/auth/me" 200

echo
echo "── Skrine, šuplíky, zložky ────────────────────────────────────────"
call POST /api/cabinets '{"name":"Firemná dokumentácia","description":"Interné veci","color":"#0ea5e9"}'
check "POST /api/cabinets" 201
CABINET="$(json_get id)"

call GET "/api/cabinets/$CABINET"
check "GET  /api/cabinets/{id}" 200

call POST /api/trays "{\"cabinetId\":$CABINET,\"name\":\"Procesy\"}"
check "POST /api/trays" 201
TRAY="$(json_get id)"

call POST /api/folders "{\"trayId\":$TRAY,\"name\":\"Onboarding\"}"
check "POST /api/folders" 201
FOLDER="$(json_get id)"

call POST /api/folders "{\"trayId\":$TRAY,\"parentId\":$FOLDER,\"name\":\"Prvý týždeň\"}"
check "POST /api/folders (vnorená)" 201
SUBFOLDER="$(json_get id)"

echo
echo "── Dokumenty a história ───────────────────────────────────────────"
call POST /api/documents "{\"trayId\":$TRAY,\"folderId\":$SUBFOLDER,\"title\":\"Vitaj v tíme\",\"content\":\"# Vitaj\\n\\nPrvý deň v **MDcabinet**.\"}"
check "POST /api/documents" 201
DOC="$(json_get id)"

call PUT "/api/documents/$DOC" '{"content":"# Vitaj\n\nPrvý deň v **MDcabinet**.\n\n## Druhý deň\n\nPokračujeme.","summary":"Doplnený druhý deň"}'
check "PUT  /api/documents/{id}" 200

call GET "/api/documents/$DOC/revisions"
check "GET  /api/documents/{id}/revisions" 200
REVISION="$(json_get id)"

call POST "/api/documents/$DOC/revisions/$REVISION/revert"
check "POST .../revisions/{id}/revert" 200

call PUT "/api/documents/$DOC/move" "{\"trayId\":$TRAY,\"folderId\":$FOLDER}"
check "PUT  /api/documents/{id}/move" 200

echo
echo "── Hľadanie ───────────────────────────────────────────────────────"
call GET "/api/search?q=MDcabinet"
check "GET  /api/search" 200

call GET /api/dashboard
check "GET  /api/dashboard" 200

echo
echo "── Zdieľanie ──────────────────────────────────────────────────────"
call POST /api/shares "{\"targetType\":\"document\",\"targetId\":$DOC}"
check "POST /api/shares" 201
TOKEN="$(json_get token)"

call GET "/api/public/$TOKEN"
check "GET  /api/public/{token}" 200

call DELETE "/api/shares/$TOKEN"
check "DELETE /api/shares/{token}" 200

echo
echo "── Ochrana registrácie ────────────────────────────────────────────"
# Nastavenia inštancie vidí len správca. Na už rozbehnutej inštancii je
# testovací účet bežný používateľ, tak sa táto časť preskočí.
call GET /api/admin/settings
if [ "$CODE" = "200" ]; then
  ORIGINAL_CODE="$(json_get registrationCode)"

  call PUT /api/admin/settings '{"registrationOpen":true,"registrationCode":"TAJNY-KOD-123"}'
  check "PUT  /api/admin/settings (nastavenie kódu)" 200

  SAVED_JAR="$JAR"; JAR="$(mktemp)"; SAVED_CSRF="$CSRF"; CSRF=""

  call POST /api/auth/register "{\"email\":\"bot+$(date +%s)@mdcabinet.test\",\"name\":\"Bot\",\"password\":\"$PASS\"}"
  check "registrácia bez kódu je odmietnutá" 422

  call POST /api/auth/register "{\"email\":\"bot2+$(date +%s)@mdcabinet.test\",\"name\":\"Bot\",\"password\":\"$PASS\",\"registrationCode\":\"zly-kod\"}"
  check "registrácia so zlým kódom je odmietnutá" 422

  call POST /api/auth/register "{\"email\":\"kolega+$(date +%s)@mdcabinet.test\",\"name\":\"Kolega\",\"password\":\"$PASS\",\"registrationCode\":\"TAJNY-KOD-123\"}"
  check "registrácia so správnym kódom prejde" 201

  rm -f "$JAR"; JAR="$SAVED_JAR"; CSRF="$SAVED_CSRF"

  call PUT /api/admin/settings "{\"registrationOpen\":true,\"registrationCode\":\"$ORIGINAL_CODE\"}"
  check "obnovenie pôvodného nastavenia" 200
else
  printf '  \033[33m•\033[0m %s\n' "preskočené – testovací účet nie je správca"
fi

echo
echo "── Bezpečnosť ─────────────────────────────────────────────────────"
SAVED_CSRF="$CSRF"; CSRF=""
call POST /api/cabinets '{"name":"Bez CSRF"}'
check "POST bez CSRF tokenu je odmietnutý" 403
CSRF="$SAVED_CSRF"

call POST /api/auth/logout
check "POST /api/auth/logout" 200

call GET /api/cabinets
check "GET  /api/cabinets po odhlásení" 401

call GET /api/documents/999999
check "GET  cudzí/neexistujúci dokument" 401

echo
echo "───────────────────────────────────────────────────────────────────"
echo "  OK: $pass    Chyby: $fail"
[ "$fail" -eq 0 ] || exit 1
