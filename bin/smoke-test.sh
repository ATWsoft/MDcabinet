#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  API smoke test – walks the main scenario: registration -> cabinet -> tray ->
#  folder -> document -> revision -> search -> sharing -> permissions.
#
#  Run against the local docker setup:
#      docker exec mdcabinet-app bash bin/smoke-test.sh
#  or against any instance:
#      BASE=https://docs.example.com bin/smoke-test.sh
# ---------------------------------------------------------------------------
set -uo pipefail

BASE="${BASE:-http://localhost}"
JAR="$(mktemp)"
REQ="$(mktemp)"
OUT="$(mktemp)"
EMAIL="smoke+$(date +%s)@mdcabinet.test"
PASS="verysecret123"

pass=0
fail=0

cleanup() { rm -f "$JAR" "$REQ" "$OUT"; }
trap cleanup EXIT

# call <METHOD> <PATH> [JSON body] -> sets BODY and CODE
#
# The body travels through a file and --data-binary: on Windows (Git Bash)
# curl.exe would re-encode UTF-8 arguments into the system code page and
# diacritics would arrive broken.
call() {
  local method="$1" path="$2" body="${3:-}"
  local args=(-s -o "$OUT" -w '%{http_code}' -X "$method"
              -b "$JAR" -c "$JAR" -H 'Accept: application/json')
  [ -n "${LOCALE:-}" ] && args+=(-H "X-Locale: $LOCALE")
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
    printf '  \033[32m+\033[0m %-48s %s\n' "$label" "$CODE"
    pass=$((pass + 1))
  else
    printf '  \033[31mx\033[0m %-48s %s (expected %s)\n' "$label" "$CODE" "$expected"
    printf '      %s\n' "$(echo "$BODY" | head -c 400)"
    fail=$((fail + 1))
  fi
}

# expect_body <label> <substring>
expect_body() {
  local label="$1" needle="$2"
  if echo "$BODY" | grep -qF -- "$needle"; then
    printf '  \033[32m+\033[0m %-48s ok\n' "$label"
    pass=$((pass + 1))
  else
    printf '  \033[31mx\033[0m %-48s missing: %s\n' "$label" "$needle"
    printf '      %s\n' "$(echo "$BODY" | head -c 300)"
    fail=$((fail + 1))
  fi
}

# json_get <key> – first value of that key in BODY (numbers and strings)
json_get() {
  echo "$BODY" | grep -o "\"$1\":[^,}]*" | head -1 | sed 's/.*://; s/^"//; s/"$//'
}

echo "MDcabinet smoke test -> $BASE"
echo

echo "-- Installation and account ---------------------------------------"
call GET /api/setup/status
check "GET  /api/setup/status" 200

call POST /api/auth/register "{\"email\":\"$EMAIL\",\"name\":\"Smoke Test\",\"password\":\"$PASS\",\"locale\":\"en\"}"
check "POST /api/auth/register" 201
CSRF="$(json_get csrf)"

call GET /api/auth/me
check "GET  /api/auth/me" 200
expect_body "instance reports available locales" '"locales"'

echo
echo "-- Localisation --------------------------------------------------"
SAVED_CSRF="$CSRF"; SAVED_JAR="$JAR"
JAR="$(mktemp)"; CSRF=""

LOCALE=en call POST /api/auth/login '{"email":"nobody@example.com","password":"wrong"}'
expect_body "error message in English" "Wrong e-mail or password."

LOCALE=sk call POST /api/auth/login '{"email":"nobody@example.com","password":"wrong"}'
expect_body "error message in Slovak" "Nesprávny e-mail alebo heslo."

rm -f "$JAR"; JAR="$SAVED_JAR"; CSRF="$SAVED_CSRF"; unset LOCALE

call PUT /api/auth/profile '{"name":"Smoke Test","locale":"sk"}'
check "PUT  /api/auth/profile (language change)" 200
expect_body "the account stores the language" '"locale":"sk"'

call PUT /api/auth/profile '{"name":"Smoke Test","locale":"en"}'
check "PUT  /api/auth/profile (back to English)" 200

echo
echo "-- Cabinets, trays, folders --------------------------------------"
call POST /api/cabinets '{"name":"Firemná dokumentácia","description":"Internal stuff","color":"#0ea5e9"}'
check "POST /api/cabinets" 201
expect_body "diacritics survived the round trip" 'Firemná dokumentácia'
CABINET="$(json_get id)"

call GET "/api/cabinets/$CABINET"
check "GET  /api/cabinets/{id}" 200

call POST /api/trays "{\"cabinetId\":$CABINET,\"name\":\"Processes\"}"
check "POST /api/trays" 201
TRAY="$(json_get id)"

call POST /api/folders "{\"trayId\":$TRAY,\"name\":\"Onboarding\"}"
check "POST /api/folders" 201
FOLDER="$(json_get id)"

call POST /api/folders "{\"trayId\":$TRAY,\"parentId\":$FOLDER,\"name\":\"First week\"}"
check "POST /api/folders (nested)" 201
SUBFOLDER="$(json_get id)"

echo
echo "-- Documents and history -----------------------------------------"
call POST /api/documents "{\"trayId\":$TRAY,\"folderId\":$SUBFOLDER,\"title\":\"Welcome aboard\",\"content\":\"# Welcome\\n\\nYour first day with **MDcabinet**.\"}"
check "POST /api/documents" 201
DOC="$(json_get id)"

call PUT "/api/documents/$DOC" '{"content":"# Welcome\n\nYour first day with **MDcabinet**.\n\n## Day two\n\nCarry on.","summary":"Added day two"}'
check "PUT  /api/documents/{id}" 200

call GET "/api/documents/$DOC/revisions"
check "GET  /api/documents/{id}/revisions" 200
REVISION="$(json_get id)"

call POST "/api/documents/$DOC/revisions/$REVISION/revert"
check "POST .../revisions/{id}/revert" 200

call PUT "/api/documents/$DOC/move" "{\"trayId\":$TRAY,\"folderId\":$FOLDER}"
check "PUT  /api/documents/{id}/move" 200

echo
echo "-- Search ---------------------------------------------------------"
call GET "/api/search?q=MDcabinet"
check "GET  /api/search" 200

call GET /api/dashboard
check "GET  /api/dashboard" 200

echo
echo "-- Sharing --------------------------------------------------------"
call POST /api/shares "{\"targetType\":\"document\",\"targetId\":$DOC}"
check "POST /api/shares" 201
TOKEN="$(json_get token)"

call GET "/api/public/$TOKEN"
check "GET  /api/public/{token}" 200

call DELETE "/api/shares/$TOKEN"
check "DELETE /api/shares/{token}" 200

echo
echo "-- Registration protection ---------------------------------------"
# Instance settings are admin-only. On an instance that is already in use the
# test account is a regular user, so this section is skipped.
call GET /api/admin/settings
if [ "$CODE" = "200" ]; then
  ORIGINAL_CODE="$(json_get registrationCode)"

  call PUT /api/admin/settings '{"registrationOpen":true,"registrationCode":"SECRET-CODE-123"}'
  check "PUT  /api/admin/settings (set the code)" 200

  SAVED_JAR="$JAR"; JAR="$(mktemp)"; SAVED_CSRF="$CSRF"; CSRF=""

  call POST /api/auth/register "{\"email\":\"bot+$(date +%s)@mdcabinet.test\",\"name\":\"Bot\",\"password\":\"$PASS\"}"
  check "registration without a code is rejected" 422

  call POST /api/auth/register "{\"email\":\"bot2+$(date +%s)@mdcabinet.test\",\"name\":\"Bot\",\"password\":\"$PASS\",\"registrationCode\":\"wrong\"}"
  check "registration with a wrong code is rejected" 422

  call POST /api/auth/register "{\"email\":\"mate+$(date +%s)@mdcabinet.test\",\"name\":\"Colleague\",\"password\":\"$PASS\",\"registrationCode\":\"SECRET-CODE-123\",\"locale\":\"sk\"}"
  check "registration with the right code succeeds" 201
  expect_body "the chosen language is stored" '"locale":"sk"'

  rm -f "$JAR"; JAR="$SAVED_JAR"; CSRF="$SAVED_CSRF"

  call PUT /api/admin/settings "{\"registrationOpen\":true,\"registrationCode\":\"$ORIGINAL_CODE\"}"
  check "previous settings restored" 200
else
  printf '  \033[33m.\033[0m %s\n' "skipped - the test account is not an administrator"
fi

echo
echo "-- Security -------------------------------------------------------"
SAVED_CSRF="$CSRF"; CSRF=""
call POST /api/cabinets '{"name":"No CSRF"}'
check "POST without a CSRF token is rejected" 403
CSRF="$SAVED_CSRF"

call POST /api/auth/logout
check "POST /api/auth/logout" 200

call GET /api/cabinets
check "GET  /api/cabinets after signing out" 401

call GET /api/documents/999999
check "GET  someone else's / missing document" 401

echo
echo "-------------------------------------------------------------------"
echo "  OK: $pass    Failures: $fail"
[ "$fail" -eq 0 ] || exit 1
