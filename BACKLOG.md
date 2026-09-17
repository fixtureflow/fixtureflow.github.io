# FixtureFlow Hosting & Website Backlog

This document is the single backlog for the `fixtureflow.github.io` monorepo (marketing pages, legal/privacy templates, and hosting infrastructure).

For backend webhook items (spam controls, double opt-in, CRM sheet performance), see `ddlc-marketing/BACKLOG.md`.

---

## 📋 Active Backlog & Planned Enhancements

### 1. Club Member Privacy Notice Refinement (Priority 3)
- **Status**: Baseline template ([`club-privacy-template.html`](./club-privacy-template.html)) is live and linked in both DDLC and CourtFlow footers.
- **Trigger**: Gated by onboarding the next external club.
- **Action**: Review controller/processor disclosures alongside the onboarding club committee's specific data-handling practices and update template guidance if needed.

### 2. Future Deployment Cadence Hardening
- **Objective**: Prevent micro-commit noise in this repository during active PWA development.
- **Action**: Update `.husky/post-commit` in `ddlc-dev` and `courtflow-dev` to run `npm run pwa:build` (local compile) on checkpoint commits, and only run `npm run pwa:publish` (push to GitHub Pages) when a feature is ready for physical device testing.

### 3. OpenGraph Social Share Preview Cards
- **Objective**: Add OpenGraph metadata tags (`og:title`, `og:description`, `og:image`, `og:url`, `twitter:card`) to public marketing pages (`index.html`, `courtflow/index.html`, `ddlc/index.html`).
- **Benefit**: Displays branded rich preview cards with custom banner thumbnails and descriptions when sharing links on WhatsApp, iMessage, and social channels.

---

## ✅ Completed Milestones

### Waitlist Frontend Hardening — M4 & M6 Parity (Sep 2026)
- **Objective**: Eliminate the silent false-success window where `mode: 'no-cors'` discarded `LOCK_TIMEOUT` or server errors, causing leads to vanish while reporting success.
- **Resolution**: Upgraded both [`ddlc/script.js`](./ddlc/script.js) (`c724e63`) and [`courtflow/index.html`](./courtflow/index.html) (`8a9b703`) to `mode: 'cors'` with structured JSON error handling, accessible `aria-live` status regions, theme-aware error styling (`var(--color-alert)`), and GDPR consent notices at the point of collection linking to [`privacy.html`](./privacy.html).

### Repository Conventions & Isolation Contract (Sep 2026)
- **Objective**: Prevent cross-product staging accidents (`git add .` or staging parent `leagues/` / `courtflow/` directories) and codify ownership scopes.
- **Resolution**: Added [`AGENTS.md`](./AGENTS.md) (`72ad279`) defining strict explicit-path staging rules, complete ownership scopes covering marketing pages, and protection for the local backup branch.

### Git History Milestone Condensation (Sep 2026)
- **Objective**: Collapse automated deployment micro-commits into clean milestone history while preserving pre-curation history.
- **Resolution**: Curated `main` history and preserved the complete 311-commit pre-curation history in the local-only branch `backup/full-history-311-commits`.
