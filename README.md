# CV Pilot — AI-Powered CV Generation Platform

CV Pilot is a multi-user SaaS tool that helps recruiters generate tailored CVs at scale. It uses a library-first approach to minimise Claude API costs — matching existing bullet points from a personal library before making any AI calls.

## Architecture at a glance

```
cv-pilot-v2/
├── backend/          FastAPI Python API
├── frontend/         React + Vite + TypeScript + Tailwind UI
├── database/         PostgreSQL migration scripts (run in order)
└── docs/             Deployment guide
```

## Key Features

- **Library-first generation** — indexes all CV bullet points on upload; reuses them before calling Claude (saves up to 80% of API costs)
- **Three-tier strategy** — `library_only` / `library_plus_api` / `full_api` based on coverage
- **Bulk generation** — submit one candidate against up to 20 JDs in a single request
- **JD duplicate detection** — SHA-256 fingerprinting warns if another recruiter already processed the same JD + client email
- **Submission pipeline** — Kanban board (To Submit → Submitted → Reviewing → Interview → Offer → Hired / Rejected)
- **Per-user Claude model assignment** — admin assigns Haiku / Sonnet / Opus per user account
- **Cost tracking** — token usage and USD cost logged per generation; visible in admin dashboard
- **Admin dashboard** — user management, usage & cost stats, generate CVs on behalf of users

## Technology Stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI (Python 3.11+) |
| Database | Supabase (PostgreSQL + Row Level Security) |
| File storage | Supabase Storage |
| Auth | Supabase Auth (JWT) |
| AI | Anthropic Claude (Haiku / Sonnet / Opus) |
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS |
| State | Zustand |
| HTTP client | Axios |

## Authentication

CV Pilot supports two login methods:

1. **Email + Password** — built-in Supabase Auth
2. **Google OAuth** — users can sign in with their Google account (optional)

To set up Google OAuth, see **[docs/GOOGLE_OAUTH_SETUP.md](docs/GOOGLE_OAUTH_SETUP.md)**.

## Quick start (local dev)

See **[docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)** for full instructions.

```bash
# Backend
cd backend
cp .env.example .env   # fill in your keys
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
cp .env.example .env   # set VITE_API_URL=http://localhost:8000/api
npm install
npm run dev
```

## Environment variables

### Backend (`backend/.env`)
| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_KEY` | Supabase service role key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `FRONTEND_URL` | Allowed CORS origin (e.g. `http://localhost:5173`) |
| `SECRET_KEY` | JWT signing secret (any random string) |

### Frontend (`frontend/.env`)
| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL (e.g. `http://localhost:8000/api`) |
| `VITE_SUPABASE_URL` | Your Supabase project URL (optional, for Google OAuth) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (optional, for Google OAuth) |

## Database setup

Run the SQL files in `database/` against your Supabase project **in order**:

```
01_schema_base.sql            Core tables (users, cvs, job_descriptions, generations)
02_schema_bullet_library.sql  CV bullet library + GIN indexes
03_schema_model_assignment.sql Per-user Claude model + audit log
04_schema_cost_tracking.sql   Token usage & cost columns
05_schema_submissions_bulk.sql Kanban submissions + bulk generation jobs
06_schema_google_oauth_trigger.sql Auto-sync users on Google OAuth signup (optional)
```

**Note:** Schema file 06 is optional and only needed if you set up Google OAuth. See [docs/GOOGLE_OAUTH_SETUP.md](docs/GOOGLE_OAUTH_SETUP.md).

## License

MIT
kiran