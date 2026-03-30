#!/bin/bash
set -euo pipefail

echo "Adding current server environment variables to Vercel production..."

npx vercel whoami >/dev/null

add_env() {
  local name="$1"
  local value="${!name:-}"

  if [ -z "$value" ]; then
    echo "Skipping $name (not set locally)"
    return 0
  fi

  printf '%s' "$value" | npx vercel env add "$name" production
}

for var in \
  NEON_DATABASE_URL \
  JWT_SECRET \
  APP_BASE_URL \
  SMTP_HOST \
  SMTP_PORT \
  SMTP_USER \
  SMTP_PASS \
  SMTP_FROM \
  SMTP_REPLY_TO \
  VITE_API_URL
do
  add_env "$var"
done

echo "Environment sync complete."
