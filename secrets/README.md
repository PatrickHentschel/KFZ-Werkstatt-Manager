# secrets/

This directory is **gitignored**. Never commit real secret values.

Docker Compose reads each secret from a plain-text file and mounts it at
`/run/secrets/<name>` inside the container. The backend reads the file if the
corresponding environment variable is not set, so the dev `.env` workflow is
unchanged.

## Required files for production

Create one file per secret using `printf` (avoids a trailing newline):

```bash
mkdir -p secrets

printf 'your-strong-db-password'          > secrets/db_password.txt       # optional: override DATABASE_URL
printf 'your-jwt-access-secret-32chars+'  > secrets/jwt_access_secret.txt
printf 'your-jwt-refresh-secret-32chars+' > secrets/jwt_refresh_secret.txt
printf 'your-smtp-password'               > secrets/smtp_pass.txt
```

Restrict permissions so only the Docker daemon can read them:

```bash
chmod 600 secrets/*.txt
```

## First-time SSL certificate

Before starting the stack for the first time, obtain a certificate via certbot:

```bash
# 1. Start nginx only (HTTP) to serve the ACME challenge
docker compose -f docker-compose.prod.yml up -d nginx

# 2. Issue the certificate (use --staging to test without rate limits)
docker compose -f docker-compose.prod.yml run --rm certbot \
  certbot certonly --webroot \
  --webroot-path /var/www/certbot \
  --email admin@yourdomain.com \
  --agree-tos --no-eff-email \
  -d yourdomain.com

# 3. Update docker/nginx/conf.d/default.conf: replace DOMAIN_PLACEHOLDER
#    with your actual domain, then start the full stack
docker compose -f docker-compose.prod.yml up -d
```

Certbot auto-renews certificates every 12 hours once the full stack is running.
