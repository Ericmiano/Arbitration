#!/bin/bash
# Builds the React client for production and stages it into
# server-laravel/public/, so Laravel serves both the API (/api/*) and the
# SPA (everything else - see server-laravel/routes/web.php) from one
# document root. Run this, review the diff, and commit the result before
# pushing to the branch cPanel's Git Version Control deploys from - cPanel
# has no Node.js runtime, so this step can't happen on the server itself.
set -euo pipefail

cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"
CLIENT_DIR="$REPO_ROOT/client"
PUBLIC_DIR="$REPO_ROOT/server-laravel/public"

echo "==> Building client (npm run build)"
(cd "$CLIENT_DIR" && npm run build)

echo "==> Clearing previously staged build output"
rm -rf "$PUBLIC_DIR/assets" "$PUBLIC_DIR/fonts" "$PUBLIC_DIR/index.html"

echo "==> Staging client/dist into server-laravel/public"
cp -r "$CLIENT_DIR/dist/assets" "$PUBLIC_DIR/assets"
cp -r "$CLIENT_DIR/dist/fonts" "$PUBLIC_DIR/fonts" 2>/dev/null || true
cp "$CLIENT_DIR/dist/index.html" "$PUBLIC_DIR/index.html"

# The build's own .htaccess (if client/public/.htaccess ever comes back) is
# for a standalone-SPA deployment and would clobber Laravel's - which
# already handles the SPA fallback via routes/web.php. Never stage it.
rm -f "$PUBLIC_DIR/.htaccess.bak"
if [ -f "$CLIENT_DIR/dist/.htaccess" ]; then
  echo "!! client/dist/.htaccess exists and was NOT copied - Laravel's own public/.htaccess already handles SPA routing + security headers. If you added it back intentionally, merge its rules into server-laravel/public/.htaccess instead."
fi

echo "==> Done. Review with 'git status' / 'git diff --stat server-laravel/public', then commit."
