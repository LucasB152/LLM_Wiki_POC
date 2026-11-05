#!/usr/bin/env bash
# Starts the API in the container: applies the pending migrations, then runs the server.
set -euo pipefail

echo "Applying database migrations..."
node_modules/.bin/prisma migrate deploy --config prisma7.config.ts

echo "Starting the API on port ${PORT}..."
exec node dist/main.js
