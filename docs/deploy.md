# Deploying gounie

This guide takes gounie from your computer to a public website on **tlfpaas**.
It takes about 30 minutes the first time.

## How the deployed app looks

tlfpaas builds and runs the two containers described in `docker-compose.yml`:

| Container | What it does | Port |
|-----------|--------------|------|
| `frontend` | nginx serves the built React app | `8080` |
| `backend` | aiohttp serves `/api/...` and the `/ws` websocket | `8081` |

tlfpaas sends `/api` and `/ws` to the backend and everything else to the frontend, all on **one address** (for example `https://gounie.example.com`).
The SQLite database lives in the `sqlite_data` volume at `/data/app.sqlite3`. It stays there when you deploy a new version.
Database migrations run automatically every time the backend starts.

---

## Step 1 — Check the app locally

From the project folder:

```powershell
uv run pytest
cd frontend
npm test
npm run build
```

Everything must pass. Optional but useful: start the production-style Docker stack on your computer (Docker Desktop must be running):

```powershell
cd C:\Users\arpat\Code\gounie
docker compose --env-file .docker.env -f docker-compose.yml -f docker-compose.local.yml up -d --build frontend gateway
```

Open http://localhost:5105. Stop it again with:

```powershell
docker compose --env-file .docker.env -f docker-compose.yml -f docker-compose.local.yml down
```

## Step 2 — Put the code in Git

Commit your work and push it to the Git repository and branch that your tlfpaas project deploys from.

```powershell
git add -A
git commit -m "gounie"
git push
```

`.env`, `.docker.env`, and `.agent.env` are in `.gitignore`. Never commit real passwords or keys.

## Step 3 — Set up email (Brevo, free)

Real users must receive the confirmation email, so production needs `EMAIL_MODE=smtp`.

1. Create a free account at [brevo.com](https://www.brevo.com/).
2. **Senders, Domains & Dedicated IPs → Senders**: add the address emails should come from and verify it.
3. **SMTP & API → SMTP**: copy the **Login**, then click **Generate a new SMTP key** and copy the key.

Keep the login and key for Step 4.

## Step 4 — Fill in secrets and settings in tlfpaas

Open your project in tlfpaas and go to the **Secrets UI**. Add these values:

| Name | What to put | Kind |
|------|-------------|------|
| `APP_MODE` | `prod` | setting |
| `APP_DEBUG_LOGS` | `1` for detailed logs (recommended at the start), `0` for warnings only | setting |
| `FRONTEND_ORIGIN` | The public address of your app, exactly as in the browser, with `https://` and **no** `/` at the end, e.g. `https://gounie.example.com` | setting |
| `DB_PATH` | `/data/app.sqlite3` | setting |
| `VITE_BACKEND_URL` | `/api` | setting |
| `COOKIE_SECRET` | A long random string (see below) | **secret** |
| `ADMIN_PASSWORD` | A strong password for the `admin` account | **secret** |
| `ALLOWED_EMAIL_DOMAINS` | Your school email domains, comma-separated, e.g. `h-farmschool.com` | setting |
| `EMAIL_MODE` | `smtp` | setting |
| `SMTP_HOST` | `smtp-relay.brevo.com` | setting |
| `SMTP_PORT` | `587` | setting |
| `SMTP_USER` | Brevo SMTP login | **secret** |
| `SMTP_PASSWORD` | Brevo SMTP key | **secret** |
| `EMAIL_FROM` | `gounie <the-sender-you-verified@example.com>` | setting |
| `KARMA_FLOOR` | `-50` | setting |

Make a random `COOKIE_SECRET` on your computer:

```powershell
uv run python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Use a different value than in your local `.env`. If `COOKIE_SECRET` changes later, everybody is logged out once.

## Step 5 — Deploy

Click **Redeploy now** in tlfpaas. This is also needed every time you change a secret or setting.
New code is deployed from the branch your project uses (Step 2).

## Step 6 — Check that it works

1. Open `https://<your address>/api/health`. You should see `{"ok": true, "data": {"status": "ok"}}`.
2. Open `https://<your address>`, log in as `admin` with your `ADMIN_PASSWORD`, and open the **Admin** page.
3. Log out, register with a school email, and check that the confirmation email arrives (also check spam).
4. Look at the backend logs in tlfpaas. A healthy start looks like this:

   ```
   INFO backend.app Starting backend mode=prod ... email_mode=smtp allowed_domains=h-farmschool.com karma_floor=-50
   INFO backend.app Database migrations finished.
   INFO backend.seed Created admin account 'admin'.
   INFO backend.app Backend startup finished.
   ```

---

## Updating the app later

1. Change code, run the tests.
2. Commit and push.
3. tlfpaas deploys the new version (click **Redeploy now** if it does not start by itself).

Users, notes, bets, and links stay, because the database is in the `sqlite_data` volume. New migrations run on start.

## When something goes wrong

| Problem | Reason and fix |
|---------|----------------|
| The backend does not start | Read the backend log. It says what is missing, e.g. `Refusing to start in prod without ADMIN_PASSWORD` or `EMAIL_MODE=smtp needs these settings: SMTP_USER`. Add the value and **Redeploy now**. |
| Login or sign-up says **Origin is not allowed** | `FRONTEND_ORIGIN` does not match the address in the browser. Check `https://`, spelling, and no `/` at the end. |
| Login works but you are logged out right away | In `APP_MODE=prod` cookies only work over `https://`. Open the app with `https://`. |
| No confirmation email | Check `EMAIL_MODE=smtp`, the Brevo login/key, and that `EMAIL_FROM` is a verified Brevo sender. The log shows `Email sending failed` with the reason. |
| The link in the email goes to `localhost` | `FRONTEND_ORIGIN` is wrong. Fix it and redeploy, then use **Resend confirmation email** on the login page. |
| "Only emails from allowed school domains can be used" | Add the domain to `ALLOWED_EMAIL_DOMAINS` and **Redeploy now**. |
| Changing `ADMIN_PASSWORD` did nothing | It is only used the first time the admin account is created. Log in as admin and use the **Account** page instead. |

## Backups

All data is one SQLite file: `/data/app.sqlite3` in the `sqlite_data` volume. If tlfpaas offers volume backups, turn them on. Deleting that volume deletes every account and note.

## Deploying somewhere else (any server with Docker)

The same `docker-compose.yml` works on any Linux server with Docker, but you need your own reverse proxy with HTTPS that routes like tlfpaas does:

- `/api` and `/api/*` → `backend:8081`
- `/ws` and `/ws/*` → `backend:8081`
- everything else → `frontend:8080`

`deploy/local/Caddyfile` shows these rules. Caddy gets HTTPS certificates automatically when you replace `:80` with your domain name. Put all settings from Step 4 into an env file on the server and start with `docker compose --env-file <that file> up -d --build`.
