# BridgeofTalent

An AI-powered, two-sided freelance marketplace: clients post jobs, freelancers apply, an AI shortlist ranks the best-fit talent, and milestone payments are held in escrow until work is approved.

Built with Next.js 14 (App Router), TypeScript, Supabase (Postgres + Auth + RLS), Tailwind CSS, OpenAI, and Stripe.

## Features

- **Auth** — email/password sign-up and sign-in (Supabase), with a client/freelancer role chosen at sign-up. A database trigger provisions each user's profile automatically.
- **Jobs** — post jobs, browse and search open jobs, and view job details.
- **Bidding loop** — freelancers apply with a rate, timeline and cover letter; job owners review applications and accept (which opens a project and adds the freelancer) or reject.
- **Freelancer profiles** — public profiles with skills, rate and reviews; freelancers edit their own profile.
- **AI** — generate a ranked shortlist of freelancers for a job (`/api/ai/match`) and draft a tailored proposal (`/api/ai/proposal`). Requires `OPENAI_API_KEY`.
- **Payments (escrow)** — Stripe Connect onboarding for freelancers, per-milestone escrow funding, and fund release. Works in a demo mode without Stripe keys (escrow is marked held so the flow is exercisable); with Stripe configured, funding creates a real PaymentIntent confirmed via webhook.
- **Reliability** — GitHub Actions CI (typecheck, lint, test, build) on every push and PR, a Vitest unit-test suite, and Upstash rate limiting on write/AI endpoints.

## Getting started

### Prerequisites

- Node.js 20+
- A Supabase project
- (Optional) OpenAI, Stripe and Upstash accounts for AI, payments and rate limiting

### Setup

```bash
git clone https://github.com/kjelili/BridgeofTalent.git
cd BridgeofTalent
npm install
cp .env.example .env.local   # then fill in the values
```

### Database

Run the migrations in `supabase/migrations` in filename order (`0001`, `0006`, `0007`, `0008`, `0009`). Either:

```bash
supabase db push
```

or paste each file into the Supabase SQL editor in order. The schema uses the `vector` (pgvector) extension for AI matching — Supabase enables it automatically via `0001`.

Then load demo data (optional):

```bash
npm run db:seed
```

This creates demo client and freelancer accounts (password `Passw0rd!demo`) and a few open jobs.

### Develop

```bash
npm run dev
```

## Environment variables

See `.env.example`. The essentials:

| Variable | Required for | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Core app | Public Supabase credentials |
| `SUPABASE_SERVICE_ROLE_KEY` | Server writes, seed | Keep secret; server-only |
| `OPENAI_API_KEY` | AI match & proposal | Without it, AI endpoints return an error |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Payments | Without them, escrow runs in demo mode |
| `NEXT_PUBLIC_APP_URL` | Stripe Connect redirects | e.g. your deployment URL |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Rate limiting | Without them, limiting is disabled (fail-open) |

The app is designed so a missing optional key degrades gracefully rather than crashing the build or the page.

## Deployment (Vercel)

1. Import the repo into Vercel.
2. **Set the Framework Preset to "Next.js"** (Settings → Build and Deployment). If it's set to a static preset, the build fails with *"No Output Directory named 'build' found"* — Next.js outputs to `.next` and needs the Next.js runtime for the API routes.
3. Add the environment variables above in Project Settings.
4. Point the Stripe webhook (if used) at `/api/webhooks/stripe`.
5. Deploy. Pushes to `main` trigger production deployments.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (next/core-web-vitals) |
| `npm run test` | Vitest |
| `npm run db:seed` | Seed demo data |

CI runs typecheck, lint, test and build on every push to `main` and every pull request (`.github/workflows/ci.yml`).

## Security notes

- **Row Level Security** is enabled on all tables: open jobs are public, and users can only write their own rows. Membership checks use `security definer` helpers to avoid policy recursion.
- **Financial writes** (escrow, milestones) go through the service-role client after authorization, so the money tables never expose direct client writes.
- **Known follow-up:** the `profiles` table is currently publicly readable so the marketplace can show names and avatars, which also exposes the `email` column. Before production, move PII behind a restricted view or column-level protection. (Marked with a comment in `0001_core_schema.sql`.)

## Status / roadmap

Delivered: auth, jobs, bidding, freelancer profiles, AI match & proposal UIs, escrow payments, CI + tests + rate limiting.

Possible next steps: email notifications (Resend), in-app notifications delivery, i18n, and a full Stripe Elements checkout for real card capture on escrow funding.
