# Project Retrospective: MindSync Optimization & Hardening

**Date:** January 21, 2026
**Version:** v1.1.0

---

## 🚀 Features Implemented

### 1. Mobile Usability & UI Polish
- **Kanban Card Actions**: Implemented "tap-to-reveal" for mobile (prevents accidental clicks) while keeping "always-visible" actions for desktop.
- **Goals Panel Pickers**: Replaced native browser inputs (white, unstyled) with custom `DatePicker` and `TimePicker` components that match the dark theme (Slate-900 + Indigo-500).
- **Responsive Navigation**: Linked navbar logo to production URL.

### 3. AI Intelligence & Critical Bug Fixes (Jan 24, 2026)
- **Specificity Overhaul**: Transitioned the AI from a suggestive assistant to an authoritative psychologist. It now "prescribes" interventions, making them much more actionable.
- **Context Filtering**: Identified and resolved "context pollution" where the AI was overwhelmed by the entire task history. Strictly filtering for the current local day restored the "smarts" users expected.
- **Unified Action Format**: Standardized how tasks are created via AI by introducing a mandatory `Date` field in the `[ACTION]` block, solving cross-day scheduling ambiguity.
- **Date Timezone Correction**: Fixed a common JS `Date` pitfall where UTC interpretation shifted dates by -1 in Western timezones. 

### 4. Security & Performance
- **Rate Limiting**: Implemented local memory-based limiting (10 req/min) to protect the API.
- **Streaming UI**: Enabled partial streaming (server-side support with frontend polling/update) for immediate user feedback.


---

## 🔧 Bugs Fixed & Challenges Overcome

### The "White Picker" Issue
- **Problem**: Native `<input type="date">` elements ignored the app's dark theme, rendering as bright white boxes on mobile/desktop.
- **Fix**: Replaced them entirely with our custom React components (`DatePicker.tsx`, `TimePicker.tsx`) which use Portals and Tailwind classes for perfect theming.

### The "Security Breakage" Incident
- **Incident**: Initial rollout of CSP headers blocked external resources (likely fonts/icons), causing the user to report the site was "broken."
- **Recovery**:
    1.  **Immediate Revert**: Restored stable state (removed Zod/CSP).
    2.  **Incremental Rollout**: Re-applied features one by one (Rate Limit → Zod → CSP).
    3.  **Refined Policy**: Explicitly allowed `fonts.googleapis.com` and `fonts.gstatic.com` in the CSP `style-src` and `font-src` directives.

---

## 📚 Lessons for Next Project

1.  **Security Should Be Incremental**: Never deploy Rate Limiting + Input Validation + CSP all at once. It makes debugging "what broke" impossible. Add one layer -> verify -> next layer.
2.  **CSP is Delicate**: When adding Content Security Policy, *always* audit external assets first (Fonts, Analytics, Images). Defaulting to `'self'` often breaks specialized UI libraries (like Google Fonts).
3.  **Centralize Prompts Early**: Don't bury large text blocks in API logic. Moving prompts to their own file (`aiPrompts.ts`) earlier would have saved scroll time and cognitive load.
4.  **Mobile First Components**: Native browser controls (date/time) are notoriously hard to style consistency. Stick to custom components for uniform UX across OSs.
5.  **Always Fix Timezones Early**: When using JS `Date`, never assume UTC is safe for local-only apps. Standardizing on `T12:00:00` for date-only strings prevents the dreaded "one-day-behind" bug in Western timezones.
6.  **Curate AI Context**: More data isn't always better. Feeding the entire task history into a chat prompt causes the AI to lose focus. Strictly filtering context for the "Current Logic Date" is essential for sharp, relevant coaching.

---

## 📝 Next Steps (Recommended)

- [ ] **Persist Rate Limits**: Move from in-memory (Map) to Redis (Upstash) for production robustness across serverless functions.
- [ ] **E2E Testing**: Add Cypress/Playwright tests for critical flows (Chat, Goal Creation) to catch regressions automatically.
- [ ] **PWA**: Add `manifest.json` and service workers to make MindSync installable on mobile.
