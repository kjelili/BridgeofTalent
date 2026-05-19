# BridgeofTalent — Build Documentation

## Overview

BridgeofTalent is a production-quality freelancing platform rebuilt as a modern React single-page application. It connects freelancers with clients, enabling job posting, bidding, team assembly, and project management.

## Architecture

**Technology Stack:**
- React 18 with Hooks (useState, useEffect, useCallback, useMemo)
- In-memory state management (production would use Redux/Zustand + REST API)
- CSS-in-JS with CSS custom properties (design tokens)
- DM Sans + Space Mono typography system
- Responsive design with CSS Grid and Flexbox

**File Structure:**
```
bridgeoftalent-app.jsx    — Complete single-file React application
```

In production, this would decompose into:
```
src/
├── components/
│   ├── Navbar.jsx
│   ├── Footer.jsx
│   ├── Toast.jsx
│   └── common/          (Button, Input, Card, Badge, Avatar)
├── pages/
│   ├── Landing.jsx
│   ├── Login.jsx
│   ├── Register.jsx
│   ├── Dashboard.jsx
│   ├── Freelancers.jsx
│   ├── Jobs.jsx
│   ├── PostJob.jsx
│   ├── Projects.jsx
│   └── About.jsx
├── store/               (state management)
├── hooks/               (custom hooks)
├── utils/               (helpers, formatters)
└── styles/              (design tokens, global CSS)
```

## Features Implemented

### 1. User Authentication
- **Registration** with role selection (Freelancer or Client)
- **Two-step registration** for freelancers (account → profile with skills)
- **Login** with email/password validation
- **Session management** via React state
- **Logout** functionality

### 2. Freelancer Profiles
- Full profile with name, title, bio, location, hourly rate
- **Skill listing** with autocomplete from 30+ predefined skills
- Star ratings and review counts
- Availability status badges (available/busy/offline)
- Avatar generation from initials

### 3. Job Posting & Browsing
- Clients can **post jobs** with full details
- Category filtering and search
- Budget range with fixed/hourly pricing
- Required skills specification
- **Team size selection** (solo or team of 2-5)
- Deadline setting
- Location type (Remote/On-site/Hybrid)

### 4. Bidding System
- Freelancers can **place bids** on open jobs
- Bid includes: amount, delivery timeline, cover letter
- Visual bid status tracking
- Clients see all bids received with freelancer ratings
- Duplicate bid prevention

### 5. Project Management
- Clients can **create projects**
- **Team assembly**: select up to 4 freelancers per project
- Visual team member cards with selection state
- Project status tracking (active/completed)
- Budget tracking per project

### 6. Dashboard (Freelancer)
- Profile summary with gradient header
- Statistics: active bids, projects, skills count
- Skills display
- Bid history with status indicators

## Design System

### Typography
- **Display/Headings:** DM Sans (800 weight, tight letter-spacing)
- **Body:** DM Sans (400-600 weight)
- **Monospace/Numbers:** Space Mono (for prices, stats)

### Color Palette
- **Brand Blue:** #338bff (primary), full scale from 50-950
- **Accent Orange:** #ff6b35 (CTAs, highlights)
- **Success Green:** #10b981
- **Warning Amber:** #f59e0b
- **Error Red:** #ef4444
- **Neutrals:** Gray scale from #fcfcfd to #101828

### Spacing
- 4px base unit
- Component padding: 16-40px
- Section padding: 32-96px
- Card gap: 16-24px

### Border Radius Scale
- sm: 6px, md: 8px, lg: 12px, xl: 16px, 2xl: 20px, full: 9999px

### Shadows
- xs through xl, using rgba(16,24,40) for consistency

### Responsive Breakpoints
- Grid auto-fill with minmax for fluid layouts
- Flexbox wrap for nav and action bars
- clamp() for fluid typography

## Security Considerations

The original Flask app had:
- CSRF protection via Flask-WTF
- Password hashing with PBKDF2-SHA256
- Account lockout after 5 failed attempts
- Security headers (XSS, HSTS, CSP, etc.)
- Input sanitization

For production React deployment, implement:
- JWT authentication with refresh tokens
- API rate limiting
- Input sanitization on both client and server
- HTTPS enforcement
- Content Security Policy headers
- CORS configuration

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Freelancer | sarah@example.com | Password123 |
| Freelancer | john@example.com | Password123 |
| Client | alex@techcorp.com | Password123 |
| Client | maria@startup.io | Password123 |

## Key Interactions

1. **Register as Freelancer** → Add skills → Browse jobs → Place bid
2. **Register as Client** → Post job → Review bids → Create project → Assemble team
3. **Browse talent** → View profiles → Filter by skill/search
4. **Project workflow** → Create project → Select team members (up to 4) → Track progress

## Accessibility

- Semantic HTML structure
- Color contrast meeting WCAG AA
- Focus management on navigation
- Touch-friendly targets (min 44px)
- Form labels and validation messages
- Screen reader friendly status badges

## Performance

- Single file, no external API calls in demo
- CSS animations over JavaScript where possible
- Memoized computed values (useMemo)
- Callback stability (useCallback)
- Conditional rendering for modals/forms

---

**Version:** 2.0.0 (React SPA Rebuild)
**Last Updated:** March 2026
