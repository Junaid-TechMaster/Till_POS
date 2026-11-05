# TillPro

Subscription till for UK shops. The product name lives in `packages/shared/src/constants.ts`.

| App | Path | What it is |
| --- | --- | --- |
| Till | `apps/till-desktop` | Windows touch till (Electron, SQLite) |
| API | `apps/api` | Licensing server (Fastify, PostgreSQL, Prisma) |
| Admin | `apps/admin` | Subscription dashboard |
| Shared | `packages/shared` | Types, money, and licence rules |

## Scripts

```bash
npm install
npm run dev:till
npm run dev:api
npm run dev:admin
npm run test
npm run build:all
npm run dist:till
```

`dist:till` writes a Windows installer to `apps/till-desktop/release/TillPro-Setup-1.0.0.exe`.

Demo dashboard and shop logins are in [DEMO.md](DEMO.md).

## Deploy the API on a VPS

1. Install Docker and copy this repository to the server.
2. Create `apps/api/keys/licence-private.pem` (PKCS8 RSA). Keep it off the git remote. Put the matching public key in `apps/till-desktop/resources/license-public.pem` and rebuild the till.
3. Export `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.
4. `docker compose up -d --build`
5. Put Caddy or nginx in front of port 8787 with a real certificate. The API trusts `X-Forwarded-Proto` and rejects plain HTTP from public hostnames.
6. Build the dashboard with `npm run build -w @tillpro/admin` and host `apps/admin/dist` on HTTPS. Set `ADMIN_ORIGIN` to that origin.
7. In the dashboard Settings, set the download URL to the installer. Create a client and send the one-time username and password.

A new client starts on a 2-day trial. Mark as Paid extends the period by one month. After the due date the till stays usable for the grace period and shows a red countdown, then locks. Sales already taken stay in the shop's SQLite file.

## Build the Windows installer

From a Windows machine, after `npm install`:

```bash
npm run dist:till
```

The NSIS installer is `apps/till-desktop/release/TillPro-Setup-1.0.0.exe`. Before you ship it, set `apps/till-desktop/resources/api-base-url.txt` to the public API URL and rebuild so the till checks the right server. The till embeds only the public key.
