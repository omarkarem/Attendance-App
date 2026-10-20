# AttendTrack handoff

Status as of October 20, 2026, branch `production` (cut from `main` at `beb08a2`).

AttendTrack is a coaching tool. A coach keeps a roster of athletes, plans recurring sessions (templates), takes attendance on the pool deck or track, records benchmark tests (run, swim, bike, other), and exports attendance and test reports as PDF or Excel.

This branch contains:

1. A full audit of the app, with every page and endpoint tested against a seeded database.
2. Server fixes for data loss, timezone, race-condition and security bugs.
3. Fixed PDF exports.
4. A complete client redesign on the dark system in `DESIGN.md`, with new components and reworked page layouts.

Commits on the branch:

| Commit | What |
|---|---|
| `cff7dc2` | Server data bugs, timezone handling, PDF exports |
| `7169ca2` | Client redesign and UI/UX bug fixes |
| `e9f2f00` | Handoff document |
| `1a6cdde` | Daily template generation: catch-up on read, watermark, Vercel Cron |

---

## 1. Running it locally

Requirements: Node 20+, a MongoDB connection string.

```bash
# server/.env
MONGODB_URI=mongodb://127.0.0.1:27017/attendtrack
JWT_SECRET=<long random string>
PORT=5000
CLIENT_URL=http://localhost:3000
CRON_SECRET=<long random string>   # optional; enables /api/cron/generate
```

```bash
cd server && npm install && npm start      # API on :5000
cd client && npm install && npm start      # app on :3000
```

The client calls `REACT_APP_API_URL` (default `http://localhost:5000/api`). On Vercel the client appends `/api` when the variable points at a `vercel.app` host. The server mounts every route under both `/api/*` and `/*`, so either value works.

`npm start` in `client/` used to crash with `options.allowedHosts[0] should be a non-empty string`. The cause was an unused `"proxy"` field in `client/package.json`, which is now removed.

---

## 2. Stack and structure

| Layer | Tech |
|---|---|
| Client | React 19, CRA 5 (`react-scripts`), React Router 7, Tailwind 3.4, Recharts 3, react-hot-toast, date-fns 4, react-icons (Phosphor set `pi`), self-hosted Geist + Inter Variable via `@fontsource-variable/*` |
| Server | Express 5, Mongoose 9, JWT (Bearer header, httpOnly cookie fallback), bcryptjs, PDFKit, ExcelJS |
| Hosting | Vercel (server has `vercel.json`, serverless) |

```
client/src
  App.js                    routes, providers, toaster, 404
  components/
    layout/AppShell.js      sidebar (desktop), top bar + bottom tabs + More sheet (mobile)
    layout/AuthLayout.js    split auth screen, password field
    ui/                     design-system primitives (see section 5)
    AssignAthletesDialog.js roster picker for sessions and templates
    AthleteFormDialog.js    add/edit athlete
    DateStepper.js          prev / label (opens date picker) / next
    PerformanceTabs.js      Record / Results / Test types tabs
    ResultFields.js         shared test-result form, validation, payload, live preview
  pages/                    one file per route
  utils/performance.js      pace/speed metrics and formatters (single source)
  utils/sessions.js         present/roster labels
  utils/browser.js          blob download, blob error parsing, clipboard fallback
server
  routes/                   auth, athletes, sessions, schedules, attendance, tests, export
  utils/dates.js            UTC calendar-day helpers, regex escaping
  utils/sessionGenerator.js race-safe lazy generation of template sessions
  utils/pdfHelpers.js       vector check/cross marks, footer, period label
  utils/export*.js          PDF and Excel generators
```

---

## 3. Feature inventory

### Auth
- Sign up (name, email, password of 6+ characters) and sign in. JWT valid for 30 days, kept in `localStorage`, plus an httpOnly cookie.
- `/auth/me` restores the session on load. Any 401 clears the token and sends the user to `/login`.
- Sign out lives in the desktop sidebar footer and in the mobile More sheet.

### Today (`/`)
- Today's sessions in a gradient card, each with Check in or Review and live counts ("3 of 6 present +1 extra").
- Stats: active athletes (with archived count), present today, sessions this month, athletes who joined this month.
- Check-ins per day this month (area chart).
- This month's attendance per athlete, sorted lowest first or A to Z. It flags the number of athletes below 50%; athletes with no sessions show "-", not a red 0%.

### Sessions (`/sessions`)
- **By day**: date stepper with a native date picker and a Today jump. The day lives in the URL (`?date=yyyy-MM-dd`), so coming back from check-in returns to the same day.
- Session rows show start time, name, Template or One-off badge, roster ("6 expected" or "Everyone expected") and counts.
- Row actions: Take or Review attendance, Edit name or time, Choose athletes, Delete (with confirmation).
- **Templates** (`?view=templates`): weekly plans with days, time and roster. You can edit, choose athletes, pause or resume, and delete them.
- Template sessions are created automatically:
  - **Catch-up on read**: Today, the attendance grid, attendance export and the day view first create every template day since the template's watermark (`generatedThrough`) up to the coach's today, then move the watermark.
  - **Daily cron**: a Vercel Cron at 03:00 UTC does the same for every coach.
  - **Viewed day**: opening any day, including future ones, creates that day's sessions.
- A deleted template session is remembered (`skippedDates`) and never recreated. Days while a template was paused are skipped. Templates that existed before the watermark start from the day of the first read, so older ambiguous gaps (never opened, or deleted under the old code) are left alone.
- Roster rule used everywhere: **an empty roster means everyone is expected**.

### Check-in (`/checkin/:id`)
- Large tap rows (Present / Absent pill), search, and an Expected / Everyone filter when the session has a roster.
- Bulk actions (mark shown present, clear shown) and copying the present list for WhatsApp, with a clipboard fallback on plain http.
- Sticky save bar: "x of y present (+n extra)", plus Unsaved changes / Not saved yet / All changes saved.
- A leave guard (in-app dialog and the browser's `beforeunload`) protects unsaved changes. Sessions where nobody came can still be saved.
- Saving writes a record for every expected athlete, plus present non-roster athletes. It clears absent non-roster records and never touches archived athletes.

### Athletes (`/athletes`, `/athlete/:id`)
- Search, Active / Archived tabs (`?show=archived`), add or edit (name, New badge).
- **Archive** (soft delete) and **Restore**; **Delete permanently** also removes attendance, test results and roster references.
- Profile:
  - gradient header with Record test, Edit, Add to template, Archive / Restore
  - stats: all-time rate, attended, current streak, tests
  - attendance by month (bars, 6 months)
  - templates enrolled, with visible remove buttons
  - performance per test: best, latest, average, change since first; a line chart with a flipped axis for pace
  - test history filtered by sport

### Performance (`/tests`, `/test-results`, `/tests?tab=types`)
- **Record** form:
  - athlete, test (grouped by sport), date (local today by default, no future dates)
  - distance, or the fixed target shown as "Set by test"
  - time (hh : mm : ss) and notes
  - optional cycling fields: weight, average/max power (FTP), cadence, heart rate
- A live preview shows pace (min/km, min/100 m), speed (km/h) or time/distance for Other, plus W/kg. A "Saved just now" list supports entering a whole squad.
- **Results**: filter by athlete name, sport and test; a table on desktop, cards on phones; edit and delete on every row; 40 per page with Show more.
- **Test types**: grouped by sport; fixed distance or fixed time; edit and delete. Deleting a type is a soft delete and keeps its results.

### Attendance grid (`/attendance`)
- Month or week view, with a session-name filter and an Expected only switch.
- Sticky header, name column and rate column. Cells show present, absent, or not recorded / not expected; a totals row shows present per session; a legend sits underneath.

### Export (`/export`)
- **Attendance**: month, year (5 back to 1 ahead) and session filter. Months with no sessions are blocked with a hint.
- **Test results**:
  - one athlete (all tests), or by test (one or more tests, all athletes, with exclusions)
  - period: 1 week, 1/3/6 months, all time, or custom
- Excel or PDF. A summary panel shows what the file will contain, and server error messages reach the user.

---

## 4. Data model and API

### Models
| Model | Key fields |
|---|---|
| User | name, email (unique), password (bcrypt, `select: false`) |
| Athlete | name (2 to 50 chars, unique per coach, case-insensitive), coach, isNewAthlete, joinDate, active |
| Schedule (template) | name, daysOfWeek [0..6], time `HH:MM`, assignedAthletes, active, **skippedDates** [`yyyy-MM-dd`] (new), **generatedThrough** `yyyy-MM-dd` watermark (new; set to the day before creation, moved past paused days on resume) |
| Session | name, coach, date (**12:00 UTC on the calendar day**), **time** `HH:MM` (new), scheduleId, **dayKey** (new, generated sessions), assignedAthletes |
| Attendance | session, athlete, coach, present, date (copied from session); unique (session, athlete) |
| TestType | title, category Running/Swimming/Cycling/Other, measureType Distance/Time, targetDistance (m), targetTime (s), active |
| TestResult | athlete, testType, date (UTC midnight of the chosen day), distance (m), time (s), description, cycling fields |

New index: `Session { scheduleId: 1, dayKey: 1 }`, unique, partial on `dayKey` being a string. Mongoose creates it on boot (autoIndex). Existing data has no `dayKey`, so the index cannot conflict.

### Endpoints (all under `/api`, all except auth need a token)
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/signup`, `/auth/login`, `/auth/logout` | |
| GET | `/auth/me` | |
| GET/POST | `/athletes` | `?active=true\|false`, `?search=` (escaped) |
| PUT/DELETE | `/athletes/:id` | DELETE archives |
| DELETE | `/athletes/:id/permanent` | cascades to attendance, test results, rosters |
| GET | `/athletes/:id/profile` | stats, 6-month trend, templates, results |
| GET | `/sessions?date=yyyy-MM-dd` | generates that day's template sessions first, sorted by time |
| GET | `/sessions?startDate&endDate` | range |
| POST | `/sessions` | `{ name, date: yyyy-MM-dd, time? }` |
| GET/PUT/DELETE | `/sessions/:id` | PUT `{ name?, time?, assignedAthletes? }`; DELETE skips the day on its template |
| GET/POST | `/schedules` | |
| PUT/DELETE | `/schedules/:id` | PUT `{ name?, daysOfWeek?, time?, active?, assignedAthletes? }`, applied to today and future sessions only |
| POST | `/attendance/bulk` | `{ sessionId, records:[{athleteId,present}], clearAthleteIds? }` |
| GET | `/attendance/session/:id`, `/attendance/monthly?month&year`, `/attendance/range?startDate&endDate` | |
| GET | `/attendance/stats?date=yyyy-MM-dd` | the client sends its local today |
| CRUD | `/tests/types`, `/tests/results` | ownership and value validation |
| GET | `/tests/results/athletes?testTypeIds=` | athletes with results, for export exclusions |
| GET | `/export?month&year&format&sessionFilter` | 404 JSON when the month has no sessions |
| GET | `/export/tests?mode&format&period&...` | |
| GET | `/cron/generate` | no user token; needs `Authorization: Bearer $CRON_SECRET`; 503 when `CRON_SECRET` is unset; returns `{ date, coaches, created }` |

Every GET from the client carries `today=yyyy-MM-dd` (the coach's local date, added in `client/src/utils/api.js`). The server uses it as the end of catch-up generation, capped at one day past UTC today.

Session list items carry `presentCount` and `totalCount` (expected athletes only), `extraCount` (present but not on the roster) and `recordCount`.

---

## 5. Design system (from `DESIGN.md`, dark only)

**Read:** a mobile-first coaching product UI, styled with the Framer-like dark canvas in `DESIGN.md`. That means poster-like display type, white pill CTAs, charcoal surfaces, one blue signal color, and one gradient spotlight card per screen.

### Tokens (`client/tailwind.config.js`)
| Token | Value | Use |
|---|---|---|
| `canvas` | `#090909` | page background |
| `surface-1` / `surface-2` | `#141414` / `#1c1c1c` | cards / raised items, inputs, selected segments |
| `line` / `line-soft` | `#262626` / `#1a1a1a` | borders / dividers |
| `ink` / `muted` | `#ffffff` / `#999999` | text; hierarchy is ink vs muted only |
| `accent` | `#0099ff` | links, focus rings, selection. Never a fill |
| `success` / `danger` | `#22c55e` / `#ff5577` | present / absent and destructive actions only |
| `bg-spot-violet`, `-magenta`, `-orange` | radial gradients | spotlight cards (Today, athlete header, auth panel) |

Type: Geist Variable for display (stands in for GT Walsheim, as `DESIGN.md` suggests) with tracking of about -4 to -5.5% at large sizes. Inter Variable for body with `cv01 cv05 cv09 cv11 ss03 ss07`.

Radius rule: inputs and rows `md` 10px, small tiles `lg` 15px, cards and dialogs `xl` 20px, spotlights `xxl` 30px, every button a pill, icon buttons full circles.

Layers: chrome 30, drawer 40, popover 50, modal 60, toast 70.

Motion: short entry rises and dialog/sheet transitions only. Everything collapses under `prefers-reduced-motion`. Chart animation is off.

### Components (`client/src/components/ui`)
| Component | Notes |
|---|---|
| `Button` | primary (white pill), secondary (charcoal), ghost, danger, translucent (on gradients); sizes sm 36, md 44, lg 48; `loading` |
| `IconButton` | 36/40px circle, `label` required (used as aria-label and title) |
| `Field`, `Input`, `Select`, `Textarea` | label above, hint or error below, `aria-invalid` styling, blue focus ring |
| `Switch` | `role="switch"` |
| `CheckRow`, `CheckMark` | full-row checkbox with a real input |
| `DurationInput` | hh : mm : ss numeric boxes |
| `Dialog` | bottom sheet on phones, centered from `sm`; focus trap, Escape, focus restore, stacked scroll lock |
| `ConfirmProvider` / `useConfirm()` | promise-based confirm; danger confirms focus Cancel |
| `Menu` | row overflow menu in a portal; flips above; arrow keys and Escape |
| `Segmented`, `SegmentedLinks` | pill tabs; selected = one surface step up |
| `Card`, `CardHeader`, `PageHeader`, `Stat`, `Badge`, `Avatar`, `Skeleton`, `EmptyState`, `WeekDots`, `Spotlight` | display primitives |
| `Chart` | shared Recharts axis, grid and tooltip styling |

Every page has skeleton loading, an error state with Try again, and an empty state with the next action.

---

## 6. Bugs found and fixed

The first column says how each bug was found: **T** = reproduced while testing the running app or API, **C** = found by reading the code. Every fix below was re-tested on this branch.

### Data and server
| # | | Bug | Fix |
|---|---|---|---|
| S1 | T | Today showed **0 sessions** on template days until someone opened the Sessions page, because generation only ran there | stats endpoint generates today's sessions |
| S2 | C | **Deleting a template-generated session did nothing lasting**: it was recreated on the next visit | `skippedDates` on the template |
| S3 | C | Two simultaneous loads of a day (React StrictMode, fast navigation) could create **duplicate sessions** | upsert on unique (scheduleId, dayKey); concurrency test passes |
| S4 | C | **Timezones**: manual sessions were stored at UTC midnight, so coaches west of UTC saw them on the previous day. Template session times were computed in the server's timezone, and shown times came from the stored timestamp | sessions stored at 12:00 UTC with a separate `time` string; UTC day ranges everywhere; older sessions show their template's time |
| S5 | C | **Data loss on re-saving attendance**: the bulk save deleted every record for athletes the client did not send, which wiped archived athletes' history | `clearAthleteIds` removes only named athletes |
| S6 | C | Changing a template roster **rewrote every past session**, so historical percentages changed | only today and future sessions are updated |
| S7 | T | Athlete names with regex characters (`(`, `+`) broke the duplicate check and search (500 or false matches) | regex escaped |
| S8 | T | Permanent delete left **orphaned test results** ("Unknown" athlete) and roster references | cascade |
| S9 | T | Attendance and results accepted athlete or test IDs belonging to **another coach** | ownership checks |
| S10 | T | Validation failures came back as 500s; the UI showed "Network error"; name-length errors were raw Mongoose text | 400 with readable messages |
| S11 | C | Stats ran about 31 + 2 per athlete queries and the profile 12 | single pass in memory |
| S12 | C | Month boundaries used the server timezone | UTC months |
| S13 | T | Exporting a month with no sessions produced an empty report | 404 with a message, and the UI blocks it |
| S14 | T | Session counts included non-roster athletes, so Sessions said "4 of 7" while check-in said "3 of 6 +1" | expected and extra counted separately |

### PDF exports (all re-checked by rendering the files)
| # | | Bug | Fix |
|---|---|---|---|
| P1 | T | Present/absent marks rendered as `'` garbage, because Helvetica has no ✓ or ✗ glyph | vector check and cross |
| P2 | T | "Generated on" footer always pushed onto a blank extra page | margin-safe footer |
| P3 | T | The best-result ★ rendered as `&` | removed (best stays bold green) |
| P4 | T | Section header subtitle in a wrong cyan/green (`#ffffffcc` is not valid in PDFKit) | white |
| P5 | T | All-time reports said "Jan 1, 2000" and "Period 9790d" | "All results up to ..." and "All" |
| P6 | T | Pace column collided with Notes ("Pace / SpeedNotes") | padded columns |
| P7 | T | "No test results" text wrapped inside the last column | full-width message |
| P8 | T | A single result showed "+0%" change | "-" when there is nothing to compare |

### Client and UX
| # | | Bug | Fix |
|---|---|---|---|
| C1 | T | `npm start` crashed (unused `proxy` field) | removed |
| C2 | C | Pinch-zoom disabled (`maximum-scale=1, user-scalable=no`), an accessibility failure | removed |
| C3 | T | Results edit/delete and "remove from template" were **hover-only**, so unreachable on phones | always-visible menus and buttons |
| C4 | T | Results table scrolled sideways on phones, hiding pace and actions | cards on phones |
| C5 | C | Deleting sessions or templates and deactivating athletes had **no confirmation**; others used `window.confirm` | in-app confirmations |
| C6 | T | A trash icon actually deactivated athletes | Archive / Restore wording and icons |
| C7 | C | Check-in: no success feedback, no unsaved-changes warning, counter divided by the whole roster | save bar, guard, correct counts |
| C8 | C | Back from check-in reset Sessions to today | day kept in the URL |
| C9 | C | Grid session filter stuck on a name missing from the new month, giving an empty grid with no chips to clear it | filter resets |
| C10 | C | Test date defaulted to the UTC date (wrong day after local midnight east of UTC) | local date |
| C11 | C | Result dates shown a day early west of UTC | UTC formatting |
| C12 | C | Pace chart axis in decimal minutes (5.33) while cards showed 5:20 | m:ss everywhere |
| C13 | C | "Other" tests compared in the wrong direction | metric chosen by measure type |
| C14 | T | Mobile session rows cramped (time wrapped "7 / AM", buttons over text) | stacked row layout |
| C15 | T | History and Export unreachable from the mobile bar except via a hidden drawer; no active tab on detail pages; top-bar avatar did nothing | 5-tab bar + More sheet; prefix matching |
| C16 | C | Desktop content offset (`pl-72`/`pl-80`) did not match the 256px sidebar | proper layout |
| C17 | C | Non-existent Tailwind classes (`border-3`, `w-4.5`, `h-4.5`, `bg-accent-500/8`, `custom-scrollbar`) | replaced |
| C18 | T | Emoji glyphs in results; low-contrast gradient wordmark | icons; solid wordmark |
| C19 | C | Export errors always generic (blob responses were not parsed) | real message |
| C20 | C | Modal had no dialog role or focus management | new `Dialog` |
| C21 | C | Copy list failed on plain http (LAN testing on a phone) | `execCommand` fallback |
| C22 | C | Templates and sessions could not be edited, and templates could not be paused | added |
| C23 | C | Dashboard "Growth & Churn" was a single-category bar chart mixing monthly and all-time numbers | replaced with stats |
| C24 | C | PWA manifest said "Create React App Sample"; theme colors mismatched | fixed |

---

## 7. How this was tested

- **Environment:** an in-memory MongoDB 7, the real server and the real client. A seed script created a coach, 10 athletes, 2 templates (one with a roster), 40 days of generated sessions with attendance, 4 test types and 55 results, including cycling data.
- **Backfill script:** 17 checks, all passing. They cover the watermark on a new template, catch-up after a gap, skipped days, legacy templates left alone, pause and resume, 5 parallel reads with no duplicates, the future-date cap, catch-up from stats and export, and cron auth (missing, wrong and unset secret), plus cron coverage and idempotence.
- **API regression script:** 20 checks, all passing. They cover concurrent generation, delete-then-reload, noon-UTC storage, time validation, `clearAthleteIds`, foreign-ID rejection, regex names, cascading deletes, result validation, stats vs list consistency and template edits.
- **Browser, desktop (1366px) and phone (375px):**
  - every page, including login and signup validation and a wrong password
  - check-in toggle, save, reload persistence, leave guard, Escape
  - creating a template (validation and generation for today), deleting a generated session (confirm, reload, stays gone)
  - recording a cycling result with live W/kg, Results filters and edit
  - grid, Export empty-month blocking, the More sheet and sign-out
  - no horizontal scroll at 375px
- **Exports:** attendance PDF, athlete PDF and multi-test PDF were downloaded through the API and inspected before and after the fixes.
- `CI=true npm run build` passes with no lint warnings.

Not covered:

- A real iPhone or Android browser (only emulated viewports).
- Vercel deployment and its environment variables.
- Opening the Excel files in Excel (they generate with status 200; the code for them is unchanged apart from date ranges).
- Clicking Download in the UI, which would save files to the machine; the same requests were verified through the API instead.

---

## 8. Known limitations and recommended next steps

Highest impact first.

1. **Template session gaps before this branch (partly resolved).** From deploy onward every template day gets its session, through catch-up on read plus the daily cron. Gaps from before deploy are deliberately not filled, because the data cannot tell "never opened" apart from "deleted under the old code". To fill a specific template's history on purpose, set its `generatedThrough` to the last day before the gap and the next read fills forward (capped at 400 days). Backfilled sessions use the template's current name, time and roster.
2. **No automated tests in the repo.** The regression checks above ran from a scratch script. Add Jest + supertest with `mongodb-memory-server` on the server, and React Testing Library for check-in and the record form.
3. **Auth hardening.** No password reset, no rate limiting on login, the JWT sits in `localStorage` (XSS-readable), and the 30-day expiry has no refresh. Also consider `helmet` and moving the CORS origin list to env vars.
4. **Timezone edge.** Days are UTC calendar days, which is correct for coaches between UTC-11 and UTC+11. When the server has to guess "today" (no `?date`), it uses UTC.
5. **Paused templates** stop creating sessions, but sessions already generated for future days (for example by browsing next week) stay until deleted.
6. **"Other" category in PDF/Excel by-test reports** still shows Latest as a time, even for fixed-time tests where distance is the result. The in-app profile handles this correctly.
7. **Bundle size** is 260 kB gzipped, mostly Recharts. Lazy-load the chart pages if first load on slow phones matters.
8. CRA (`react-scripts`) is unmaintained. Moving to Vite would speed up dev and builds; nothing in the code depends on CRA specifics.
9. The server mounts all routes twice (`/api` and `/`) to tolerate misconfigured env vars. Once Vercel env vars are confirmed, keep only `/api`.

### Deploying this branch
- No data migration is needed. New fields are optional, older sessions fall back to their template's time, and the new index only covers documents with `dayKey`.
- Set `CRON_SECRET` in the server's Vercel project to enable the daily cron (`server/vercel.json` schedules it). Without it the endpoint returns 503 and catch-up on read still keeps data complete.
- Deploy the server first. The new client sends `clearAthleteIds` and reads `extraCount`/`recordCount`, while the server still accepts old clients.
- Fonts are bundled, so no Google Fonts request is made at runtime.
