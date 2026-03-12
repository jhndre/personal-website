# Vercel + WHOOP KV setup (do once)

## 1. Create a KV store

1. Open [Vercel Dashboard](https://vercel.com/dashboard) → your project (or create one).
2. Go to **Storage** → **Create Database** → **KV**.
3. Create the store and connect it to the project.
4. In **Settings** → **Environment Variables**, you should see **KV_REST_API_URL** and **KV_REST_API_TOKEN** (or add them from the KV store’s .env snippet).

## 2. Add environment variables

In the project’s **Settings** → **Environment Variables**, add:

| Name | Value | Notes |
|------|--------|--------|
| `KV_REST_API_URL` | (from KV store) | From step 1 |
| `KV_REST_API_TOKEN` | (from KV store) | From step 1 |
| `CRON_SECRET` | Random string (e.g. 20 chars) | Used when calling `/api/whoop-sync` |
| `WHOOP_CLIENT_ID` | Your WHOOP app Client ID | From developer.whoop.com |
| `WHOOP_CLIENT_SECRET` | Your WHOOP app Client Secret | From developer.whoop.com |
| `WHOOP_REFRESH_TOKEN` | From `npm run whoop:auth` | In local `.env` after auth |

Optional for first run: `WHOOP_ACCESS_TOKEN` (also in `.env` after auth).

## 3. Seed KV from your machine (one-time)

On your laptop, with the same project cloned:

1. In **.env** add the KV vars (copy from Vercel → Storage → your KV → .env):
   - `KV_REST_API_URL=...`
   - `KV_REST_API_TOKEN=...`
2. Ensure you have WHOOP data and tokens:
   - `npm run whoop:fetch` (creates `public/whoop-data.json` and keeps tokens in `.env`)
3. Seed KV:
   - `npm run whoop:seed-kv`

This uploads `whoop-data.json` and your refresh token into KV so the first cron run can refresh tokens and data.

## 4. Deploy

Push to your repo and let Vercel deploy (or run `vercel --prod`).

The cron in **vercel.json** runs **every hour** and calls `/api/whoop-sync`. Vercel sends `Authorization: Bearer <CRON_SECRET>` when it invokes the cron, so no extra setup is needed.

## 5. Check it works

- Open `https://your-domain.com/api/whoop` → you should see JSON (WHOOP data).
- Home page and `/whoop` use that data (they try `/api/whoop` first, then fall back to static `whoop-data.json`).

If you ever need to re-seed KV (e.g. new WHOOP data), run `npm run whoop:fetch` then `npm run whoop:seed-kv` again.
