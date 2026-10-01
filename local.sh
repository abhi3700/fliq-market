#!/usr/bin/env bash
set -euo pipefail

# Refresh the branch-based widget dependency before building. npm otherwise
# reuses the commit recorded in package-lock.json when the spec is unchanged.
npm install --save --force 'github:abhi3700/unifi-pay-widget#main'

# Build
npm run build

# Local dev
npx wrangler pages dev dist --port 8788
