#!/bin/sh
set -e

echo "Migrations complete, starting application..."
exec node dist/apps/api/main.js