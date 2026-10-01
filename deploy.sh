#!/usr/bin/env bash
set -euo pipefail

npm ci
npm run build
npx wrangler pages deploy dist --project-name fliqm --branch main