# TillPro API

The licensing server. The till talks only to `/license/*` and `/sync/*`. The private signing key never leaves this app.

## Local

1. Start Postgres (`docker compose up postgres` from the repo root, or your own server).
2. Copy `.env.example` to `.env` and set `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.
3. Put the RSA private key at `keys/licence-private.pem`. The matching public key is `apps/till-desktop/resources/license-public.pem`.
4. From the repo root:

```bash
npm run build -w @tillpro/shared
npm run prisma:generate -w @tillpro/api
npm run prisma:migrate -w @tillpro/api
npm run seed -w @tillpro/api
npm run dev:api
```

The API listens on port 8787. In production it refuses requests that are not HTTPS (the proxy must send `X-Forwarded-Proto: https`).

A status job runs at startup and every minute. It moves trials and paid periods into grace, then to suspended, from the dates.

## Dashboard login

Only the seeded SuperAdmin (and users that admin creates) can sign in. There is no public registration.
