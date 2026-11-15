#!/usr/bin/env bash
# Hilfsskript für .github/workflows/release.yml (Jobs create-draft und publish).
# Aufruf: TAG=v… GH_TOKEN=… GITHUB_REPOSITORY=owner/repo bash desktop/scripts/release-step.sh <create|publish>
# Gibt auf stdout nur die Entwurfs-ID aus (wie release-check.js), Hinweise gehen nach stderr.
#
# Warum nicht mehr „gh api --paginate --slurp | node release-check.js“: Diese Pipe ist
# am 15.11.2026 auf dem Runner dreimal mit einem Speicherfehler abgestürzt
# (malloc(): invalid size, Exit 134/139), einmal beim Anlegen, zweimal beim
# Veröffentlichen — die Builds selbst waren jedes Mal grün. Deshalb:
#   1. Release-Liste seitenweise mit curl in eine Datei holen (kein --slurp),
#   2. release-check.js liest die Datei,
#   3. nur bei einem Absturz (Exit >= 128) bis zu dreimal wiederholen; echte
#      Prüffehler (Exit 1, z.B. fehlende Assets) schlagen sofort fehl.
set -euo pipefail

MODE="${1:?create|publish erwartet}"
: "${GH_TOKEN:?GH_TOKEN fehlt}" "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY fehlt}" "${TAG:?TAG fehlt}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FILE="$(mktemp)"
trap 'rm -f "$FILE"' EXIT

retry() {
  local _retry_try=1 _retry_rc
  while true; do
    if "$@"; then return 0; else _retry_rc=$?; fi
    if [ "$_retry_rc" -lt 128 ] || [ "$_retry_try" -ge 3 ]; then return "$_retry_rc"; fi
    echo "::warning::$1 ist abgestürzt (Exit $_retry_rc), Versuch $((_retry_try + 1)) von 3" >&2
    _retry_try=$((_retry_try + 1))
    sleep 3
  done
}

# Alle Seiten als JSON-Array von Seiten — dasselbe Format wie früher --slurp,
# release-check.js (findReleases) macht daraus eine flache Liste.
fetch_releases() {
  local page=1 body first=1
  printf '[' > "$FILE"
  while [ "$page" -le 20 ]; do
    body="$(curl -fsSL --retry 3 --retry-delay 2 \
      -H "Authorization: Bearer $GH_TOKEN" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "https://api.github.com/repos/$GITHUB_REPOSITORY/releases?per_page=100&page=$page")"
    if [ "$(printf '%s' "$body" | tr -d '[:space:]')" = "[]" ]; then break; fi
    if [ "$first" -eq 0 ]; then printf ',' >> "$FILE"; fi
    printf '%s' "$body" >> "$FILE"
    first=0
    page=$((page + 1))
  done
  printf ']' >> "$FILE"
}

retry fetch_releases
retry node "$SCRIPT_DIR/release-check.js" "$MODE" "$FILE"
