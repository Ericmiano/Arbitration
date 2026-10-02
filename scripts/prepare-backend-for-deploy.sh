#!/bin/bash
# Builds a production (--no-dev) vendor/ and commits it as part of the repo,
# since Composer's availability on the cPanel host is unconfirmed (no
# SSH/Terminal to check for it) - shipping a pre-built vendor/ removes that
# dependency entirely instead of gambling on it at deploy time.
#
# Run this, commit, push, deploy - then run it again with --dev-restore (or
# just `composer install` yourself) before continuing local development,
# since it temporarily replaces your dev vendor/ with a stripped-down one.
set -euo pipefail

cd "$(dirname "$0")/../server-laravel"

if [ "${1:-}" = "--dev-restore" ]; then
  echo "==> Restoring full dev vendor/ (composer install)"
  composer install
  echo "==> Done - vendor/ has dev dependencies again. Don't commit this state."
  exit 0
fi

echo "==> Building production vendor/ (composer install --no-dev --optimize-autoloader)"
composer install --no-dev --optimize-autoloader --no-interaction

echo "==> Done. This vendor/ is deploy-ready and should be committed as-is."
echo "==> Before you go back to local development, run:"
echo "        ./scripts/prepare-backend-for-deploy.sh --dev-restore"
echo "    otherwise phpunit/pail/etc. (dev-only tools) will be missing."
