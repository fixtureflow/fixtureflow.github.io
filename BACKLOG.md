# FixtureFlow Hosting & Website Backlog

## 📋 Planned Maintenance & Repository Hygiene

### 1. Git History Milestone Condensation (Planned)
- **Objective**: Collapse the ~231 automated deployment commits into 5 authoritative, high-signal milestone commits that preserve the product story without micro-commit noise.
- **Safety Pre-condition**: Create permanent archive branch `archive/full-history-pre-squash` before any operation.
- **Target 5-Milestone Architecture**:
  1. `chore(release): initial FixtureFlow branding and early standalone PWAs` (June 2026)
  2. `feat(marketing): launch unified master hub, club registry, and demo sandbox` (Aug 2026)
  3. `release(courtflow): deploy CourtFlow v2.0.0 production PWA and dev isolation` (Sep 1-3, 2026)
  4. `feat(leagues): launch multi-portal standalone headless architecture (/leagues)` (Sep 3, 2026)
  5. `feat(pwa): harden GAS API response handling and sync current baseline` (Sep 6, 2026)

### 2. Future Deployment Cadence Hardening
- **Objective**: Prevent future commit bombardment in this repository.
- **Action**: Update `.husky/post-commit` in `ddlc-dev` and `courtflow-dev` to run `npm run pwa:build` (local compile) on checkpoint commits, and only run `npm run pwa:publish` (push to GitHub Pages) when a feature is ready for physical device testing.
