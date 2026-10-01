#!/usr/bin/env bash
set -euo pipefail

# Refresh the branch-based widget dependency before starting Vite. npm otherwise
# reuses the commit recorded in package-lock.json when the spec is unchanged.
npm update --save unifi-pay-widget

# Start the Vite development server with hot reload.
exec npm run dev
