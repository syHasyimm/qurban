#!/bin/sh
set -eu

if [ "${1:-}" = "node" ] && [ "${2:-}" = "server.js" ]; then
  node /app/scripts/migrate.mjs
fi

exec "$@"
