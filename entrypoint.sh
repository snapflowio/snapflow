#!/bin/sh
set -e
echo "Migrations complete, starting proxy..."
exec ./dist/apps/proxy

echo "Starting API..."
exec node dist/apps/api/main.js