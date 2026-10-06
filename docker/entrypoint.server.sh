#!/bin/sh
set -e

echo "==> Waiting for PostgreSQL..."
until npx prisma migrate status --schema=../prisma/schema.prisma 2>/dev/null; do
  echo "    PostgreSQL not ready, retrying in 3s..."
  sleep 3
done

echo "==> Running Prisma migrations..."
npx prisma migrate deploy --schema=../prisma/schema.prisma

echo "==> Starting server..."
exec node dist/app.js
