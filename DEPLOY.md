# CV Pilot — Production Deployment Guide

**Stack:** FastAPI backend on Railway · React/Vite frontend on Vercel · Supabase DB + Auth

---

## Step 1 — Get a Domain (10 min)

1. Go to [namecheap.com](https://www.namecheap.com) or [porkbun.com](https://porkbun.com)
2. Search for your name — e.g. `cvpilot.app`, `getcvpilot.com`, `cvpilot.io`
3. Buy it (~$10–15/year)
4. You'll point it to Railway (backend) and Vercel (frontend) in later steps

---

## Step 2 — Push code to GitHub

Make sure your repo is pushed with all recent changes:

```bash
cd cv-pilot-v2
git add -A
git commit -m "prod: add deployment configs, fix admin auth, fix async broadcast"
git push origin main
```

> ⚠️ Never commit `.env` files — they're in `.gitignore`. Secrets go in Railway/Vercel dashboards only.

---

## Step 3 — Deploy Backend on Railway

1. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**
2. Select your repo, set the **Root Directory** to `cv-pilot-v2/backend`
3. Railway will auto-detect the Dockerfile and build it
4. Go to **Variables** tab and add ALL of these:

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
ENV=production
FRONTEND_URL=https://your-vercel-app.vercel.app   ← update after Vercel deploy
EXTRA_CORS_ORIGINS=https://yourcustomdomain.com   ← add after domain setup
SECRET_KEY=generate-a-random-32-char-string
```

5. Click **Deploy** — wait ~2 min for build
6. Go to **Settings → Networking → Generate Domain** to get your Railway URL
   - e.g. `https://cvpilot-backend-production.up.railway.app`
7. (Optional) Add your custom domain under **Settings → Networking → Custom Domain**
   - Point your domain's DNS `A record` or `CNAME` to Railway's provided value

---

## Step 4 — Deploy Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project → Import Git Repository**
2. Select your repo, set **Root Directory** to `cv-pilot-v2/frontend`
3. Framework: **Vite** (auto-detected)
4. Add these **Environment Variables**:

```
VITE_API_URL=https://your-railway-backend-url.up.railway.app
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

5. Click **Deploy** — Vercel builds and gives you a URL like `cvpilot.vercel.app`
6. Go back to Railway → Variables → update `FRONTEND_URL` to this Vercel URL
7. (Optional) Add your custom domain in Vercel → **Settings → Domains**
   - Point your domain's CNAME to `cname.vercel-dns.com`

---

## Step 5 — Run Database Migrations

In your **Supabase SQL Editor**, run these files IN ORDER (if not already done):

```
01_schema_base.sql
02_schema_bullet_library.sql
03_schema_model_assignment.sql
04_schema_cost_tracking.sql
05_schema_submissions_bulk.sql
06_schema_google_oauth_trigger.sql
07_schema_openai_support.sql
08_schema_model_settings.sql
09_schema_allowed_models_list.sql   ← MUST run this one for model restrictions to work
```

---

## Step 6 — Smoke Test

1. Open your Vercel URL → register a new account → login
2. Upload a CV → paste a JD → click Generate
3. Login to admin account → open Admin Panel → verify users and model settings load
4. Change a user's model access → logout → login as that user → verify dropdown shows correct models

---

## Quick Reference

| Service | URL |
|---|---|
| Backend (Railway) | `https://your-app.up.railway.app` |
| Frontend (Vercel) | `https://your-app.vercel.app` |
| Supabase Dashboard | `https://supabase.com/dashboard` |
| Health Check | `https://your-railway-url/health` |

---

## Environment Variables Cheatsheet

### Backend (Railway)
| Variable | Where to find it |
|---|---|
| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_KEY` | Supabase → Settings → API → **service_role** key |
| `SUPABASE_JWT_SECRET` | Supabase → Settings → API → JWT Secret |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `OPENAI_API_KEY` | platform.openai.com → API Keys |
| `SECRET_KEY` | Any random 32-char string |
| `FRONTEND_URL` | Your Vercel URL |

### Frontend (Vercel)
| Variable | Where to find it |
|---|---|
| `VITE_API_URL` | Your Railway backend URL |
| `VITE_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API → **anon** key |
