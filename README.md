# gounie

gounie is a small, silly web app for fellow students. You sign up with a **nickname**, a **password**, and a **school email** (only allowed email domains work, and the email must be confirmed).

Visitors without an account can read **Is it Friday yet?**, **EPS-bet**, and **the great url collection**. Betting, adding or voting on links, walls, and slots need an account. The home page shows a login form to visitors.

| Page                         | What it does                                                                                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Is it Friday yet?**        | A huge red **NO**. On Fridays (your own clock): **YES!** and confetti. That's it.                                                                                       |
| **The Wall**                 | Everybody has a wall. Anyone can stick notes or pictures on it. Pick the note color and text color on a color circle, make the text regular, bold, italic, underlined, or strikethrough, and turn the note to any angle (360°). The page claims everything is editable and deletable, but after posting only the rotation can change (right-click → Edit, or ✏️), and Delete never works: _whoops.. something went wrong_. |
| **EPS-bet**                    | Bet karma on what will happen. Pick YES or NO. Right = 2× your stake back. Every bet has a discussion. New bets are published only after the admin approves them.         |
| **the great url collection** | A big bank of useful links. Search, add, edit, delete your own. Votes give the author +1 / -1 karma.                                                                      |
| **slots**                    | Gamble your karma. The page never shows the odds; players have to find out for themselves (see Karma rules).                                                                |

It was built from the `templatePWA` teaching template:

- **Frontend** — React app with TypeScript, built with Vite, styled with Tailwind CSS.
- **Backend** — Python web server using aiohttp, stores data in a SQLite file.
- **Tests** — backend tests (pytest), frontend unit tests (Vitest), and browser tests (Playwright).

---

## Karma rules

- Everyone starts with **0 karma**.
- **EPS-bet**: a new bet is not live right away. It waits on the admin page until the admin approves or declines it, and the person who proposed it gets an email either way. Only approved bets can be seen, bet on, or discussed. Then: your stake is taken when you bet. If your side wins, you get **2×** back. If not, nothing. One bet per person per question, no changes — the creator can bet on their own question too. The creator must reveal the outcome after the deadline. If they don't reveal it within **7 days** after the deadline, everyone gets their stake back. The admin can reveal or cancel any bet.
- **slots**: the stake is taken, the pay table decides the payout. Average payback is exactly 10%.
- **URL votes**: an upvote gives the link author +1 karma, a downvote -1. You can change or remove your vote. You can't vote on your own links.
- **Karma floor**: bets and spins can't take your karma below `KARMA_FLOOR` (default **-50**). Downvotes can.
- **Recovery**: if your karma is below 0, you have no open bets, and 24 hours passed since your last gamble (placing a bet, a bet closing, a slot spin) or since you went negative, your karma is reset to 0. A background job checks this every 5 minutes.

---

## Words you will see in this guide

| Word          | What it means                                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **terminal**  | A text window where you type commands. On Mac it is called Terminal, on Windows it is called Command Prompt or PowerShell. |
| **git**       | A tool that downloads and tracks code. Every command starts with `git`.                                                    |
| **npm**       | Node Package Manager — downloads JavaScript libraries that the frontend needs.                                             |
| **uv**        | A tool that downloads Python libraries that the backend needs.                                                             |
| **make**      | A shortcut tool. `make setup` is just a shorter way to run several commands at once.                                       |
| **localhost** | Your own computer. `http://localhost:5101` means "open port 5101 on my own machine".                                       |

---

## Project folders

```
gounie/
├── backend/
│   ├── auth/         ← login, sign-up, email confirmation, passwords
│   ├── db/           ← all SQL (SQLite) code
│   ├── games/        ← slot machine and betting rules
│   ├── http/         ← API routes for wall, bets, links, slots, admin
│   ├── mail/         ← sending emails (SMTP or log)
│   ├── migrations/   ← database tables
│   └── tests/
└── frontend/
    ├── src/pages/    ← one file per page
    ├── src/features/ ← wall and bet pieces
    ├── src/shared/   ← API helper, live updates, shared UI
    └── tests/e2e/    ← Playwright browser tests
```

---

## Before you start — check your tools

```bash
uv -V      # Python package manager. Install: curl -LsSf https://astral.sh/uv/install.sh | sh
npm -v     # JavaScript package manager. Install Node.js 24 (for example with nvm).
```

---

## First-time setup

```bash
make setup
```

`make setup` installs Python and JavaScript libraries, installs browsers for tests, and creates the local config files `.env`, `.docker.env`, and `.agent.env` from the `*.example` files.

---

## Running the app in development

You need **two terminals**:

```bash
make back    # backend on http://localhost:3101
make front   # frontend on http://localhost:5101
```

Open `http://localhost:5101`.

### Accounts in development

| Nickname | Password                                                     | Notes                                                                               |
| -------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `admin`  | value of `ADMIN_PASSWORD` in `.env` (`admin` in the example) | Created on the first start. Changing `ADMIN_PASSWORD` later does **not** change it. |
| `user`   | `userpass1`                                                  | Dev mode only. Email already confirmed.                                             |

### Emails in development

With `EMAIL_MODE=log` (the default in `.env.example`) no real emails are sent. The backend terminal prints each email, including the confirmation or reset link:

```
INFO backend.email EMAIL_MODE=log, email not really sent. to=alice@example.edu subject=Confirm your gounie account
...
http://localhost:5101/confirm?token=...
```

Copy the link into your browser.

---

## Settings

Local settings live in the root `.env` file. Docker settings live in `.docker.env`. Do not edit the `Makefile`, compose files, or Playwright configs for normal configuration.

| Variable                     | What it is                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `ADMIN_PASSWORD`             | Password for the `admin` account, used only when it is created on the first start. Required in prod. |
| `ALLOWED_EMAIL_DOMAINS`      | Comma-separated email domains that may sign up, for example `school.edu,uni.edu`.                    |
| `EMAIL_MODE`                 | `log` (only print emails) or `smtp` (really send them).                                              |
| `SMTP_HOST`, `SMTP_PORT`     | SMTP server, for Brevo `smtp-relay.brevo.com` and `587`.                                             |
| `SMTP_USER`, `SMTP_PASSWORD` | SMTP login and SMTP key.                                                                             |
| `EMAIL_FROM`                 | Sender address, for example `gounie <gounie@example.com>`. Must be a verified sender in Brevo.       |
| `KARMA_FLOOR`                  | Lowest karma reachable by bets and slots. Default `-50`.                                               |
| `COOKIE_SECRET`              | Secret key for signing cookies and email tokens.                                                     |
| `FRONTEND_ORIGIN`            | Public URL of the app. Email links use it.                                                           |

---

## Sending real emails with Brevo (free)

1. Create a free account at [brevo.com](https://www.brevo.com/) (300 emails per day).
2. Go to **Senders, Domains & Dedicated IPs → Senders**, add the address you want to send from, and verify it.
3. Go to **SMTP & API → SMTP**. Copy the **Login** and click **Generate a new SMTP key**.
4. Set these values (in `.env` locally, or in the tlfpaas Secrets UI in production):

   ```env
   EMAIL_MODE=smtp
   SMTP_HOST=smtp-relay.brevo.com
   SMTP_PORT=587
   SMTP_USER=<the Brevo SMTP login>
   SMTP_PASSWORD=<the SMTP key>
   EMAIL_FROM=gounie <your-verified-sender@example.com>
   ```

Without your own domain, some emails may land in spam. Tell people to check their spam folder.

---

## Logs

The backend writes logs to the terminal (and container logs in Docker). It logs:

- startup settings (without secrets), requests, and websocket connections;
- sign-ups, email confirmations, logins (ok, failed, blocked), logouts, password changes and resets;
- every email sent, and every email that failed, with the error;
- wall notes, pictures that were rejected, and every fake delete attempt;
- bets created, wagers, reveals, cancels, refunds, and comments;
- links created, edited, deleted, and every vote;
- every slot spin (stake, reels, payout, new karma);
- **every karma change** with its reason, 24h recoveries, and admin actions;
- full stack traces for unexpected errors.

Passwords, tokens, and SMTP secrets are never logged (except email links in `EMAIL_MODE=log`, which is meant for development).
Set `APP_DEBUG_LOGS=0` for quieter logs. Every karma change is also saved in the `karma_changes` table. The admin page shows it with the **History** button.

---

## Running tests

```bash
make test               # backend, frontend unit, and e2e tests
uv run pytest           # backend only
cd frontend && npm test # frontend unit tests only
cd frontend && npm run test:e2e
make test-e2e-docker    # e2e tests against the Docker stack
```

## Formatting code

```bash
make format
```

## Adding a new library

```bash
uv add package-name            # backend
cd frontend && npm install package-name   # frontend
```

---

## Useful make shortcuts

| Command                 | What it does                                       |
| ----------------------- | -------------------------------------------------- |
| `make setup`            | First-time install of everything                   |
| `make back`             | Start backend with auto-reload                     |
| `make back-once`        | Start backend without auto-reload                  |
| `make front`            | Start frontend dev server                          |
| `make open`             | Open the app in the browser                        |
| `make format`           | Format all code                                    |
| `make test`             | Run all tests                                      |
| `make test-e2e-docker`  | Run browser tests against Docker containers        |
| `make deps-update-safe` | Update dependencies within the same major versions |

---

## Docker (optional, for deployment)

```bash
make front-docker   # builds and starts backend, frontend, and a local gateway
make open-docker    # opens http://localhost:5105
make stop-docker
make clean-docker
```

The local gateway uses the same path-based routing as production:

- `/api/*` -> backend
- `/ws` -> backend
- everything else -> frontend

---

## Production deployment (tlfpaas)

**Step-by-step guide: [docs/deploy.md](docs/deploy.md).** The summary below is a quick reference.

The base `docker-compose.yml` is platform-safe for tlfpaas: it uses `expose`, `tlfpaas.route` labels, and no published ports.
SQLite data lives in the `sqlite_data` volume at `/data/app.sqlite3`.

Set these values in the **tlfpaas Secrets UI** (never commit them to Git), then click **Redeploy now**:

| Variable                  | Example                                      | Kind   |
| ------------------------- | -------------------------------------------- | ------ |
| `COOKIE_SECRET`           | a long random string                         | secret |
| `ADMIN_PASSWORD`          | a strong password for `admin`                | secret |
| `SMTP_USER`               | Brevo SMTP login                             | secret |
| `SMTP_PASSWORD`           | Brevo SMTP key                               | secret |
| `ALLOWED_EMAIL_DOMAINS`   | `school.edu,uni.edu`                         | config |
| `EMAIL_MODE`              | `smtp`                                       | config |
| `SMTP_HOST` / `SMTP_PORT` | `smtp-relay.brevo.com` / `587`               | config |
| `EMAIL_FROM`              | `gounie <you@example.com>`                   | config |
| `KARMA_FLOOR`               | `-50`                                        | config |
| `APP_MODE`                | `prod`                                       | config |
| `APP_DEBUG_LOGS`          | `1` for detailed logs, `0` for warnings only | config |
| `FRONTEND_ORIGIN`         | `https://gounie.example.com`                 | config |
| `DB_PATH`                 | `/data/app.sqlite3`                          | config |
| `VITE_BACKEND_URL`        | `/api`                                       | config |

In `APP_MODE=prod` the backend refuses to start with the default `COOKIE_SECRET`, without `ADMIN_PASSWORD`, without `ALLOWED_EMAIL_DOMAINS`, or with `EMAIL_MODE=smtp` and missing SMTP settings. The error message says what is missing.
To change allowed domains later, edit `ALLOWED_EMAIL_DOMAINS` in the Secrets UI and click **Redeploy now**.

---

## Security notes (for learning)

- Passwords are stored as Argon2 hashes — not as plain text.
- Login uses `HttpOnly` cookies so JavaScript cannot read them. `SameSite=Lax` cookies protect against most cross-site request attacks.
- Email confirmation and reset links are random, single-use, expire, and are stored only as hashes.
- Pictures are checked, shrunk, and re-saved as WebP on the server, which also removes hidden metadata like GPS location.
- Emails are never shown to other users. Only the admin page shows them.
