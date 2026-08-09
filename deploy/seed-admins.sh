#!/usr/bin/env bash
# Crea/actualiza las cuentas de administrador de Scopes en PocketBase.
# Idempotente: si el correo ya existe, solo reasegura role=admin (no pisa la contraseña).
#
# Las credenciales NO se versionan: viven en deploy/admins.env (chmod 600, gitignored).
#   PB_URL=http://127.0.0.1:8091
#   PB_SUPERUSER=...
#   PB_SUPERUSER_PASS=...
#   ADMIN_<slug>_EMAIL / ADMIN_<slug>_NAME / ADMIN_<slug>_PASS
set -euo pipefail

cd "$(dirname "$0")"
[ -f admins.env ] || { echo "Falta deploy/admins.env"; exit 1; }
# shellcheck disable=SC1091
source admins.env

TOKEN=$(curl -sS -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H 'Content-Type: application/json' \
  -d "$(printf '{"identity":"%s","password":"%s"}' "$PB_SUPERUSER" "$PB_SUPERUSER_PASS")" \
  | grep -oP '"token":"\K[^"]+')
[ -n "$TOKEN" ] || { echo "No se pudo autenticar como superuser"; exit 1; }

for slug in "${ADMINS[@]}"; do
  email_var="ADMIN_${slug}_EMAIL"; name_var="ADMIN_${slug}_NAME"; pass_var="ADMIN_${slug}_PASS"
  email="${!email_var}"; name="${!name_var}"; pass="${!pass_var}"

  existing=$(curl -sS -G "$PB_URL/api/collections/users/records" \
    -H "Authorization: Bearer $TOKEN" \
    --data-urlencode "filter=(email='$email')" | grep -oP '"id":"\K[^"]{15}' | head -1 || true)

  if [ -n "$existing" ]; then
    curl -sS -o /dev/null -X PATCH "$PB_URL/api/collections/users/records/$existing" \
      -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
      -d '{"role":"admin","emailVisibility":true,"verified":true}'
    echo "= $email (ya existía, role=admin reasegurado)"
  else
    code=$(curl -sS -o /tmp/seed-admin-out.json -w '%{http_code}' -X POST "$PB_URL/api/collections/users/records" \
      -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
      -d "$(printf '{"email":"%s","password":"%s","passwordConfirm":"%s","name":"%s","role":"admin","emailVisibility":true,"verified":true}' \
            "$email" "$pass" "$pass" "$name")")
    if [ "$code" = "200" ]; then echo "+ $email creado"; else echo "! $email falló ($code): $(cat /tmp/seed-admin-out.json)"; fi
  fi
done
