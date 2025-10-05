# Project Phase Breakdown for course content (1.0 → 4.0)

A complete, developer-friendly record of what we built, why we built it this way, and how to extend it safely. This document is meant for maintainers, contributors, and future you.

---

## Pillars (applied across all phases)

- **Simplicity** — decisions bias toward minimal, legible code that’s easy to reason about.
- **Robustness** — strict DTOs, defensive early returns, and resilient fallbacks.
- **Efficiency** — only fetch what the client renders; avoid unnecessary work.
- **Ease of management** — central “assembly points” (API DTOs and UI types).
- **Security** — read-only content delivery; role-aware UI; no data overexposure.

---

## Phase 1.0 — Core Course UX

**Goals**

- Create a stable course detail page with module/lesson navigation.
- Tolerate missing backend pieces with a local placeholder.
- Persist client progress in localStorage to survive reloads.

**Key Work**

- `app/dashboard/course/page.tsx` scaffolding.
- Simple `ModuleList`, `VideoPlayer`, and `QuizCard` components.
- Local placeholder for content to prevent blank pages during integration.

**Why**

- Establish a stable shell so API iterations don’t block UX.

---

## Phase 2.0 — API & Progress

### Phase 2.1 — Public Course Endpoints

**Goals**

- Provide a robust, read-only API for published course data.
- Keep the DTO minimal and front-end shaped (no schema coupling).

**Key Work**

- `app/api/courses/route.ts`: list published courses (lightweight `moduleCount`).
- `app/api/courses/[slug]/route.ts`: fetch a single published course (modules sorted; lessons placeholder).

**Notes**

- Strict 404 for hidden/unpublished courses.
- Explicit DTO mapping in the API (future schema changes don’t break the UI).

### Phase 2.2 — Progress Persistence

**Goals**

- Save progress (module/lesson indices + answers) reliably.
- Work offline or if API is temporarily unavailable.

**Key Work**

- Client: localStorage with defensive parsing and clamping.
- Server: progress endpoints (if desired). Client already debounces writes.

**Notes**

- The page never blocks on progress writes. UX first.

### Phase 2.3 — Certificate (100% Completion)

**Goals**

- Generate a clean PDF certificate in memory once the course is complete.

**Key Work**

- `lib/certificate.ts`: `generateCertificatePDF(...)` returning a `Buffer`.
- API (e.g., `/api/courses/certificate`) streams the `application/pdf`.
- UI: “🎓 Download Certificate” button appears at 100%.

**Why**

- Completion proof without scoring or gamification.

---

## Phase 3.0 — UX Enhancements

### Phase 3.1 — Feedback & Motion

**Goals**

- Add subtle motion while keeping the UI calm and focused.
- Respect accessibility (reduced motion).

**Key Work**

- Framer Motion transitions for lessons.
- Tap/hover micro-interactions on navigation/certificate buttons.

**Notes**

- Avoided heavy libraries and global state; motion is localized.

### Phase 3.2 — Navigation Polish

**Goals**

- Improve discoverability and ergonomics of navigation.

**Key Work**

- Keyboard shortcuts (← / →).
- Sticky header for persistent context.
- Disabled states on navigation buttons at bounds.
- `ModuleList` visual highlight improvements.

**Why**

- Reduce friction for users to move through content efficiently.

### Phase 3.3 — Lesson Transitions + Micro-interactions

**Goals**

- Wrap final motion into a cohesive, low-noise experience.

**Key Work**

- Fade/slide enter/exit animations when the lesson changes.
- Button micro-interactions: tactile tap/hover.

---

## Phase 4.0 — Final Polish

**Goals**

- Tidy up code to be dev-friendly and ESLint-quiet.

**Key Work**

- Sorted imports by group (core → Next → third-party → internal).
- `useCallback` wrappers for `goNextLesson` / `goPrevLesson` (stable refs).
- “Phase History” header comments on major files.
- This `docs/PHASE_BREAKDOWN.md` for long-term references.

---

## Architectural Notes

- **Read-only delivery**: Admins (you/stakeholders) finalize content outside the app. The site _delivers_ (not edits) course materials.
- **Strict DTOs**: APIs map DB rows into stable response shapes that the UI expects. This avoids Prisma schema coupling.
- **Minimal payloads**: Only select fields the UI renders. Avoids unnecessary bandwidth and cognitive load.
- **Progress model**: LocalStorage-first with optional server persistence (debounced). UX remains smooth in poor networks.

---

## Extensibility

- **Lessons/Quizzes**: Can switch to relational tables later; keep DTO constant and just enrich in API.
- **Branding**: Add `doc.image(...)` in `lib/certificate.ts` to include a logo/signature.
- **Additional Courses**: `/api/courses` already lists published courses; the UI can let users pick one.
- **Internationalization**: The DTO shape is i18n-friendly (titles, summaries, bodies are strings).

---

## Maintenance Tips

- Keep “Phase History” comments updated in files you modify.
- If ESLint flags stale closure warnings, prefer `useCallback` for shared handlers.
- Avoid adding new global state unless absolutely necessary — keep motion and interactions local to pages/components.

---

## Credits

- Course experience designed with a bias toward respect, empathy, and clarity.
- Motion is subtle and accessibility-aware; no “flashy for the sake of flashy.”
