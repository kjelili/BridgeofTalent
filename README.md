# BridgeofTalent — Freelancing Platform

A production-quality freelancing platform connecting top freelancers with clients.
Built as a modern React single-page application with job posting, bidding, team
assembly, escrow payments, and project management.

> **Note:** This repository was previously named *Talent-Bridge / TalentBridge*.
> It has been renamed to **BridgeofTalent** and consolidated into a single,
> clean, deployable codebase (the previous duplicate standalone `.jsx`/`.html`
> files were removed to prevent code drift).

---

## Quick Start

```bash
npm install
npm start           # dev server at http://localhost:3000
npm test            # run the test suite
npm run build       # production build into ./build
```

The build output in `./build` is a static bundle that can be served by any
static host or CDN.

---

## Demo Accounts

| Role       | Email                | Password    |
| ---------- | -------------------- | ----------- |
| Freelancer | sarah@example.com    | Password123 |
| Freelancer | john@example.com     | Password123 |
| Client     | alex@techcorp.com    | Password123 |
| Client     | maria@startup.io     | Password123 |

---

## What's New in This Release (v2.1.0)

This release focused on reliability, code quality, and competitive parity:

- **Renamed** to BridgeofTalent across the entire codebase, assets, and metadata.
- **Repository consolidated** to a single deployable Create React App project
  (removed redundant duplicate standalone files).
- **Zero build warnings** — fixed all unused-variable and unsafe-regex lint
  warnings; the production build now compiles cleanly.
- **Test suite fixed and expanded** — the previously failing render test now
  passes, plus added coverage for the hero and CTAs.
- **Job Success Score** — a transparent, data-derived trust signal (0–100)
  shown on talent cards and profiles, with a dedicated sort option. This mirrors
  the visibility mechanic that dominates competing platforms in 2026.
- **Transparent flat 5% fee** — a live fee breakdown in the bid flow showing
  exactly what a freelancer keeps. No sliding scales, per-bid credits, or hidden
  buyer charges (a direct response to the leading competitor pain point).
- **Saved searches** — clients and freelancers can save job/talent searches and
  manage them from the Saved page.
- **"Why BridgeofTalent"** landing section communicating the competitive
  differentiators (fee transparency, escrow, verified talent, smart matching).
- **Deployment-ready** — added Dockerfile, nginx config, static-host configs
  (Netlify / Vercel), and a GitHub Actions CI workflow.

---

## Competitive Positioning

Based on a 2026 review of Upwork, Fiverr, Toptal, Freelancer.com and newer
low-fee entrants, three themes consistently determine where freelancers and
clients go:

| Theme              | Industry norm                | BridgeofTalent                       |
| ------------------ | ---------------------------- | ------------------------------------ |
| Platform fees      | 10–20% sliding / 20% flat    | **Flat, transparent 5%**             |
| Trust & visibility | Job Success Score, badges    | **JSS + verified skills + identity** |
| Payment protection | Escrow / milestones          | **Escrow on every project**          |
| Matching           | Manual search, bid credits   | **Free skill-based smart matching**  |

These are reflected directly in the product (fee breakdown in bids, JSS on
profiles, escrow release in projects, recommended jobs/freelancers).

---

## Architecture

- **React 19** — Hooks-based functional components
- **CSS-in-JS** — design tokens injected via a `<style>` element
- **In-memory state** — seeded demo data; see Security Notes for production path
- **Zero runtime dependencies** beyond React itself

```
src/
├── App.js              Single-file application (pages + state)
├── utils/security.js   Input sanitization & validation helpers
├── index.js            React entry point
└── *.css               Global styles
public/                 Static assets, manifest, index.html
```

For a production codebase this would be decomposed into `components/`,
`pages/`, `store/`, `hooks/`, `api/` — see `BUILD_DOCUMENTATION.md`.

---

## Deployment

### Static host (Netlify / Vercel / S3 / Cloudflare Pages)

```bash
npm run build
# deploy the ./build directory
```

`netlify.toml` and `vercel.json` are included with SPA rewrite rules.

### Docker

```bash
docker build -t bridgeoftalent .
docker run -p 8080:80 bridgeoftalent
# open http://localhost:8080
```

### CI

`.github/workflows/ci.yml` installs dependencies, runs the test suite, and
produces a production build on every push and pull request.

---

## Security Notes

This is a client-side demo with in-memory state. See `SECURITY.md` for the
implemented client-side protections and the backend hardening checklist
(JWT/httpOnly cookies, server-side hashing, rate limiting, CSP, parameterized
queries) required before a real production launch.

---

**Version:** 2.1.0
**Last Updated:** May 2026
