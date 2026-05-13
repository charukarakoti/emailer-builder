# Architecture & Roadmap

This document describes how `emailer-builder` is wired today, the gap between today's state and a Mailchimp/Brevo-style SaaS platform, and the phased plan to close that gap without rewriting working parts.

## 1. Where the project is today

The original project was a single-user, browser-only email design tool. The recent server work added a real backend layer underneath it without changing the editor UX.

```
┌──────────────────────────────────────────────┐
│            Next.js 14 (App Router)           │
│                                              │
│   /          → Builder (existing UI)         │
│   /login     → email + password sign-in      │
│   /signup    → create account + workspace    │
│   /team      → members + invites + switch    │
│   /api/auth  → signup / login / logout / me  │
│   /api/teams → list / create / current / …   │
│   /api/templates                              │
│                                              │
│   middleware.ts → bounces anon → /login      │
└─────────────────────┬────────────────────────┘
                      │ Prisma
                      ▼
              SQLite (prisma/dev.db)
   User ─ Membership ─ Team ─ Template
   Invite                       │
   Session                      └─ owner (User)
```

What's already done (the parts the new feature work must not break):

- The visual editor — `components/Builder.tsx`, `components/Canvas.tsx`, `components/blocks/*`, `components/TopBar.tsx`, `components/RightPanel.tsx`, the zustand store in `lib/store.ts`, and the email HTML generator in `lib/htmlGenerator.ts`. These are untouched by the SaaS work and stay as-is.
- Auth: bcrypt + opaque cookie session (hash-at-rest), in `lib/auth.ts` plus four `/api/auth/*` routes.
- Workspaces: the `Team` model is the workspace primitive. A user is added as `OWNER` of a freshly-created workspace at signup. Multiple teams per user, switch via session row.
- Team-scoped templates: anyone in the workspace can read, only the original author can edit/delete.
- Local-to-shared migration: the old `localStorage`-based `lib/userTemplates.ts` has been swapped for API calls — the editor itself didn't have to change.

## 2. Gap analysis — requested vs done

| Area | Requested | Today | Gap |
|---|---|---|---|
| Database | PostgreSQL + Prisma | SQLite + Prisma (provider-swap to PG is one line) | Move to PG when deploying |
| Auth | Signup/login/logout, protected routes, sessions, multi-user, roles | Done. `OWNER`/`MEMBER` roles via Membership. | Add password reset, e-mail verification |
| Schema — users / workspaces / templates | All three | All three | — |
| Schema — template_versions | Snapshot history | — | Add `TemplateVersion` |
| Schema — contacts, lists, tags, joins | Full CRM model | — | Add `Contact`, `List`, `ContactList`, `Tag`, `ContactTag` |
| Schema — campaigns, recipients, events | Full sending model | — | Add `Campaign`, `CampaignRecipient`, `EmailEvent` |
| Schema — forms, submissions | Form builder + capture | — | Add `Form`, `FormSubmission` |
| Schema — media | Image library | — | Add `Media` |
| Schema — activity_logs | Audit | — | Add `ActivityLog` |
| Builder enhancements — autosave, save to DB, duplicate, delete | Most | Save / delete / share-by-team done; autosave is local-only; duplicate exists in-canvas | Move autosave to server, add explicit "Duplicate template" + public toggle |
| Image library | Upload + manage | — | New: S3/Cloudinary upload, /media page |
| Campaigns | Create / schedule / send / test | — | New: campaign wizard, scheduler, Resend/SES adapter |
| Analytics | Opens, clicks, bounces, unsubs | — | New: tracking pixel + redirect endpoint + dashboard charts |
| Forms | Builder, embed, popup, submissions | — | New: form builder, public JS embed, capture endpoint |

## 3. Architecture target

The end-state stays inside the Next.js app so deployment, code style, and auth are uniform. Anything heavy that doesn't belong in a request lifecycle (sending email, tracking pixel writes) is queued.

```
┌──────────────────────────────── Next.js app ────────────────────────────────┐
│                                                                             │
│  app/ (UI)                                                                  │
│   ├ /                builder (existing)                                     │
│   ├ /login /signup   auth (existing)                                        │
│   ├ /team            workspace mgmt (existing)                              │
│   ├ /templates       list + duplicate + share (new)                         │
│   ├ /contacts        CRM (new)                                              │
│   ├ /campaigns       send & schedule (new)                                  │
│   ├ /forms           form builder + submissions (new)                       │
│   ├ /media           image library (new)                                    │
│   └ /analytics       dashboard (new)                                        │
│                                                                             │
│  app/api/ (route handlers — workspace-scoped via requireSession())          │
│   ├ auth/*           (existing)                                             │
│   ├ teams/*          (existing — workspace = Team)                          │
│   ├ templates/* + versions                                                  │
│   ├ contacts/* + import                                                     │
│   ├ lists/*  tags/*                                                         │
│   ├ campaigns/* + send + test                                               │
│   ├ forms/* + public submit endpoint                                        │
│   ├ media/* + sign-upload                                                   │
│   ├ events/track/open  events/track/click   events/track/unsub              │
│   └ activity/*                                                              │
│                                                                             │
│  lib/                                                                       │
│   ├ prisma.ts        singleton (existing)                                   │
│   ├ auth.ts          bcrypt + session (existing)                            │
│   ├ store.ts htmlGenerator.ts blockRegistry.ts (existing — untouched)       │
│   ├ workspace.ts     "current workspace" helpers (new)                      │
│   ├ csv.ts           CSV parse + map (new)                                  │
│   ├ email/                                                                  │
│   │   ├ provider.ts  pluggable: resend | ses | sendgrid | console (new)     │
│   │   └ render.ts    inline tracking pixel + link rewrite (new)             │
│   ├ media/                                                                  │
│   │   └ storage.ts   pluggable: s3 | cloudinary | local (new)               │
│   └ activity.ts      structured logging helper (new)                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
            │                          │                          │
            ▼                          ▼                          ▼
        Postgres                  S3 / Cloudinary           Resend / SES / SG
   (was SQLite for dev)         (campaign-scoped key)      (provider chosen via env)
```

External services are pluggable through thin adapter files (`lib/email/provider.ts`, `lib/media/storage.ts`) so swapping providers is an env-variable change, not a code change. The default dev experience uses a "console" email provider that logs sends to stdout, and a "local" media storage that writes to `public/uploads/` — so you can build the whole flow without any cloud accounts.

## 4. Roadmap — five phases

Each phase ends with something demoable and a release-able cut of the codebase. The order minimises rework: data-layer first, then user-facing CRUD, then sending/tracking.

### Phase 0 — already done
- Auth, workspaces, team-scoped templates API, login/signup/team UI.
- localStorage → DB migration of saved templates.

### Phase 1 — Foundation (this commit)
- Extend Prisma schema to all 16 tables.
- Stub workspace-scoped route handlers for every new domain.
- Build the **Contacts** feature end-to-end as the reference vertical slice: schema, API, page, CSV import, list/tag association.
- `ARCHITECTURE.md`, `MIGRATION.md`.

### Phase 2 — CRM completion
- `/lists`, `/tags`, `/segments` UI (segments = saved filters over Contact).
- Search + bulk actions in `/contacts`.
- Contact detail page with activity timeline.

### Phase 3 — Sending
- `lib/email/provider.ts` with `console`, `resend`, `ses`, `sendgrid` adapters.
- `/campaigns` wizard: pick template → pick audience (list / segment) → preview → send / schedule / test-send.
- Background job runner (Vercel Cron or local `node-cron`) to drain due campaigns.
- Per-recipient render with tracking-pixel injection and click-link rewriting.

### Phase 4 — Tracking & dashboards
- `/api/events/track/{open,click,unsub}` handlers write to `EmailEvent`.
- `/analytics` dashboard: opens, clicks, bounces, unsubs over time + per-campaign breakdown.
- Activity feed on `/dashboard` powered by `ActivityLog`.

### Phase 5 — Forms & media
- `/forms` builder reusing block/canvas patterns from the email editor.
- Public `/embed/forms/[id]` script + iframe + popup variants.
- `/media` library backed by `lib/media/storage.ts`.

### Phase 6 — Polish & production
- Switch Postgres on, deploy migrations, configure email provider.
- Rate-limit public endpoints (form submit, tracking pixel).
- Backups, monitoring, error reporting.
- Password reset + email verification + invitations via real email.

## 5. Coding conventions

The new code follows the patterns already in the project:

- **Route handlers** wrap their body in `try { … } catch (e) { … }` and **always return JSON** (no thrown HTML errors). The shared shape is `{ data }` on success and `{ error: string }` on failure.
- **Workspace scoping**: every workspace-bound resource is filtered by `session.activeTeamId`. There is no global query path. Helper `requireSession()` throws a 401 if the user isn't signed in.
- **JSON columns on SQLite**: `doc` / `payload` / `meta` are stored as `String` and `JSON.stringify`/`JSON.parse`'d at the route boundary. When Postgres is enabled this can be flipped to `Json` columns without changing the API.
- **No new globals on the client**. Server data is fetched per page; the zustand store is reserved for editor state only.
- **Existing files are not rewritten.** Where the SaaS work needs a feature already in a file, it's added alongside the existing exports.

## 6. Reading order for the new code

1. `prisma/schema.prisma` — the data model is the contract.
2. `MIGRATION.md` — how to move existing data into the new schema.
3. `app/api/contacts/route.ts` and `app/contacts/page.tsx` — the reference slice. Every new feature follows this shape.
4. `lib/auth.ts`, `lib/prisma.ts` — already in place, all new routes use them.
