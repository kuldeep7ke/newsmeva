#!/bin/sh
set -e

# First boot: create backend/.env from the example with a generated JWT_SECRET.
# Existing env vars (DATABASE_URL, JWT_SECRET, PORT) are NOT overridden,
# because dotenv leaves already-set process.env values untouched.
ENV_FILE="$PWD/.env"
if [ ! -f "$ENV_FILE" ]; then
  cp .env.example "$ENV_FILE"
  SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${SECRET}|" "$ENV_FILE"
  echo "[newsmeva] created .env with a generated JWT_SECRET" >&2
fi

exec "$@"