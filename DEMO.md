# TillPro demo logins

The dashboard shows **Failed to fetch** when the licensing server is not running. Start the database and the API first, then sign in.

## Start everything

From the project folder:

```bash
npm run dev:api
npm run dev:admin
```

`dev:api` starts a local PostgreSQL database, applies the tables, and loads the demo accounts. The database files stay in `apps/api/data` and are not part of the git repository. The API listens on http://127.0.0.1:8787. The dashboard is http://localhost:5174.

The installed TillPro program uses that same local API address.

## Dashboard (you)

| | |
| --- | --- |
| Address | http://localhost:5174 |
| Email | `admin@localhost` |
| Password | `ChangeMeNow-12345` |

There is no public registration. This account is created from `apps/api/.env`.

## Shop account (the installed till)

On the till's **Activate this till** screen:

| | |
| --- | --- |
| Username | `demo-shop` |
| Password | `DemoShop-12345` |

The shop code is `TP-000001`. It is already paid and active for one year, and it can be used on up to 3 computers. That same username and password is the till admin. On the till, choose **Admin** and sign in with:

| | |
| --- | --- |
| Username | `demo-shop` |
| Password | `DemoShop-12345` |

The admin can create one cashier under **Extras → Staff**. The cashier signs in with the ID and PIN the admin sets, and can use the rest of the till. A cashier can change only their own PIN. The admin can change the cashier and the admin password.
