# TillPro dashboard

Web panel for shops on a monthly subscription. It talks to the API in `apps/api`.

```bash
npm run dev:admin
```

Open http://localhost:5174. Sign in with the email and password from the API `.env`. Set `VITE_API_URL` if the API is not on `http://127.0.0.1:8787`.

Serve the built `dist` folder over HTTPS. The API `ADMIN_ORIGIN` must be this site's origin.
