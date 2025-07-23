#!/bin/sh
set -e

echo "Starting API..."
exec node dist/apps/api/main.js