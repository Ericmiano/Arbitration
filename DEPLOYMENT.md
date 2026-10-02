# Deploying to cPanel (aak.or.ke account)

Confirmed on the actual account:
- **Git™ Version Control**: enabled, no repos yet.
- **Custom Document Root**: not available for the main domain (`aak.or.ke`
  is fixed to `public_html`, normal on shared cPanel), but **is** available
  for subdomains - confirmed via Domains → Manage on `convention.aak.or.ke`.
- **Composer**: unconfirmed (no SSH, no Terminal, File Manager locked to
  the home folder) - so this plan doesn't depend on it being there at all.

**Given that: the app lives on its own subdomain**, e.g.
`arbitration.aak.or.ke` (pick whatever name you want - substitute it below),
with that subdomain's Document Root pointed at the Laravel app's `public/`
folder. `aak.or.ke` itself keeps serving whatever's in `public_html` today,
untouched.

Both the React client and the Laravel API are served from that one
subdomain: Laravel serves `/api/*` directly, and everything else falls
through to the built React SPA (`server-laravel/routes/web.php`). Same
origin, so no CORS configuration and no cross-domain cookie issues.

cPanel has no Node.js runtime and Composer isn't confirmed, so **both the
frontend build and the PHP dependencies are prepared locally** and
committed - cPanel's Git™ Version Control then deploys the already-built
repo via `.cpanel.yml`, with nothing to install server-side.

## One-time cPanel setup

1. **Subdomain**: cPanel → *Domains* → *Create A New Domain* → e.g.
   `arbitration.aak.or.ke`. Leave its Document Root at the default for now
   (step 5 changes it once the live app directory exists).
2. **PHP version**: cPanel → *Select PHP Version* → 8.2 or newer for that
   subdomain (matches `composer.json`'s `"php": "^8.2"`). Enable the
   `curl`, `fileinfo`, `gd`, `intl`, `mbstring`, `openssl`, `pdo_mysql`
   extensions if they're off.
3. **MySQL**: create a database and a user (cPanel → *MySQL® Databases*),
   and note the credentials - they go in the live `.env`, never in git.
4. **Git™ Version Control**: cPanel → *Git™ Version Control* → *Create*.
   - Clone URL: this repo's GitHub URL.
   - Repository Path: something private, e.g. `repositories/aak-arbitration`
     - anywhere outside `public_html` and outside the subdomain's own
     folder (cPanel's own default suggestion is fine).
5. **Live app directory**: pick a persistent path outside any web root,
   e.g. `$HOME/aak-laravel` (`/home3/aakork/aak-laravel`), and put that
   same path in `.cpanel.yml`'s `LIVE_APP_PATH`. Create a real `.env` there
   once (copy `server-laravel/.env.example`, fill in real values - see
   below) - the deploy script never overwrites `.env` or `storage/` on
   later deploys.
6. **Document Root**: back in *Domains* → *Manage* for the subdomain, set
   "New Document Root" to `aak-laravel/public` (i.e. `$LIVE_APP_PATH/public`).
7. **Cron** (cPanel → *Cron Jobs*): one entry, every minute:
   ```
   * * * * * php /home3/aakork/aak-laravel/artisan schedule:run >> /dev/null 2>&1
   ```
   Laravel's own scheduler (`routes/console.php`) decides what's actually
   due (currently just the daily case-update reminder job) - this single
   cron line is the only one ever needed, even as more scheduled jobs are added.
8. **Backups**: a second cron entry for the nightly DB + document backup
   (see `server-laravel/scripts/backup-db.sh`):
   ```
   0 2 * * * /bin/bash /home3/aakork/aak-laravel/scripts/backup-db.sh >> /home3/aakork/backup.log 2>&1
   ```
   Also check cPanel → *Backup* / *Backup Wizard* - many hosts already run
   account-level backups; this cron is a second, independent copy, not a
   replacement for confirming that.

## Every deploy

```bash
# 1. Build the frontend and stage it into server-laravel/public/
./scripts/build-frontend-for-deploy.sh

# 2. Build a production (--no-dev) vendor/ - Composer's availability on the
#    host is unconfirmed, so this ships pre-built instead of depending on it.
./scripts/prepare-backend-for-deploy.sh

# 3. Review and commit the result (source + build output + vendor/)
git status
git add -A
git commit -m "Deploy: <what changed>"
git push

# 4. Restore your OWN dev environment (the previous step stripped vendor/
#    down to production-only) before you keep developing locally:
./scripts/prepare-backend-for-deploy.sh --dev-restore

# 5. In cPanel → Git™ Version Control → this repo → "Manage" → "Pull or Deploy"
#    → Update from Remote, then Deploy HEAD Commit.
#    That runs .cpanel.yml, which rsyncs into LIVE_APP_PATH and runs
#    migrations + cache rebuilds - no server-side install step at all.
```

## Required production `.env` values (in `LIVE_APP_PATH/.env`, not git)

```
APP_ENV=production
APP_DEBUG=false
APP_URL=https://arbitration.aak.or.ke
FRONTEND_URL=https://arbitration.aak.or.ke

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_DATABASE=<cpanel_db_name>
DB_USERNAME=<cpanel_db_user>
DB_PASSWORD=<cpanel_db_password>

# Same-origin deploy - the frontend and API share this one subdomain.
SANCTUM_STATEFUL_DOMAINS=arbitration.aak.or.ke
SESSION_DOMAIN=arbitration.aak.or.ke
SESSION_SECURE_COOKIE=true
SESSION_DRIVER=file

DOCUMENT_STORAGE_PATH=/home3/aakork/aak-laravel-storage/documents
MAX_UPLOAD_MB=25
CASE_UPDATE_TARGET_DAYS=14

MAIL_MAILER=smtp
MAIL_HOST=<cpanel-provided or your SMTP host>
MAIL_PORT=587
MAIL_USERNAME=<...>
MAIL_PASSWORD=<...>
MAIL_FROM_ADDRESS=noreply@aak.or.ke

# AI-assisted document scanning (optional - blank disables it cleanly)
ANTHROPIC_API_KEY=<a workspace-scoped key>
ANTHROPIC_MODEL=claude-sonnet-5
```

`DOCUMENT_STORAGE_PATH` should point **outside** `public/` (uploaded case
documents must never be web-servable directly - `DocumentController`
streams them through an authenticated route instead) - and outside
`LIVE_APP_PATH` too, since the rsync in `.cpanel.yml` doesn't touch
anything outside it but there's no reason to tempt fate on a future deploy
script change.

## If Composer turns out to be available after all

Nothing above needs changing - a committed `vendor/` and a Composer
install aren't mutually exclusive. If you later confirm cPanel's Software
section has a Composer manager, you can switch `.cpanel.yml` back to
running `composer install --no-dev --optimize-autoloader` at deploy time
and drop `scripts/prepare-backend-for-deploy.sh` from your workflow - purely
an optional cleanup, not something blocking you today.

## What's still needed from you

- The subdomain name you want (`arbitration.aak.or.ke` used as the example
  throughout - swap in whatever you actually create).
- Confirm the real live app path once you know it (`/home3/aakork/...` -
  your home directory is confirmed as `/home3/aakork` from the
  `convention.aak.or.ke` check, but the folder name `aak-laravel` is just a
  suggestion).
