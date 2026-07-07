# Wesualize Studio Management System — Architecture & Design

A senior-architect blueprint for a commercial-grade internal SaaS used daily by studio
leadership and staff. Every major decision is justified and compared against alternatives.

---

## 1. Technology stack recommendation & justification

**Chosen stack:** Next.js 14 (App Router, TypeScript) · PostgreSQL · Prisma · Auth.js (NextAuth) ·
Tailwind CSS · Recharts · Zod. All free, open-source, production-proven and actively maintained.

### Why this stack for a small-to-medium creative studio

| Requirement | How the stack satisfies it |
|-------------|----------------------------|
| **One thing to deploy** | Next.js is full-stack — UI, API routes and server logic ship as a single app. A 1–2 person IT function can operate it. |
| **Cost-effective** | Deploys free/cheap on Vercel, Railway, Render or a single VPS. PostgreSQL is free. No per-seat licensing. |
| **Fast, data-dense dashboards** | React Server Components fetch and render KPIs server-side → small payloads, fast first paint, less client JS. |
| **Type safety end-to-end** | TypeScript + Prisma + Zod give compile-time safety from DB row to React prop, reducing production bugs. |
| **Maintainability** | Huge community, conventional file-based routing, generated DB client. Easy to onboard new developers. |
| **Scalable** | Stateless app servers (JWT sessions) scale horizontally; PostgreSQL scales vertically + read replicas. |

### Alternatives considered

| Option | Why not (for this context) |
|--------|----------------------------|
| **MERN (Express + React SPA + MongoDB)** | Two codebases to deploy/maintain; MongoDB is a poor fit for the highly **relational** data here (employees↔projects↔tasks↔clients). Joins/aggregations for analytics are awkward. |
| **Django / Rails** | Excellent admin/ORM, but server-rendered templates make a *premium reactive dashboard* harder; a separate JS frontend re-introduces the two-codebase problem. |
| **Laravel + Inertia** | Strong, but smaller talent pool for an animation studio and PHP hosting is less "free-tier" friendly than Node. |
| **Supabase/Firebase BaaS** | Fast to start, but vendor lock-in, and complex RBAC + server-side BI calculations are cleaner in owned application code. |
| **MySQL instead of PostgreSQL** | Postgres wins on JSON columns (audit metadata), partial/expression indexes, window functions for analytics, and stricter constraints. |
| **Drizzle instead of Prisma** | Viable; Prisma chosen for its mature migrations, Studio GUI and richer relation ergonomics for a small team. |

---

## 2. System architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Browser (React)                          │
│   Server Components (data) + Client Components (interaction)     │
│   Tailwind design tokens · Recharts · next-themes (dark mode)   │
└───────────────┬────────────────────────────────────────────────┘
                │ HTTPS
┌───────────────▼────────────────────────────────────────────────┐
│                   Next.js 14 (App Router)                        │
│  ┌───────────────┐  ┌────────────────┐  ┌────────────────────┐  │
│  │ RSC page data │  │ Route Handlers │  │  middleware.ts     │  │
│  │ (lib/*直读DB) │  │ /api/* (CRUD)  │  │  (auth gate)       │  │
│  └───────┬───────┘  └───────┬────────┘  └────────────────────┘  │
│          │   withAuth() + RBAC (lib/rbac, lib/api)               │
│  ┌───────▼───────────────────────────────────────────────────┐  │
│  │  Domain libs: bi.ts (BI engine) · reports.ts · audit.ts    │  │
│  └───────┬───────────────────────────────────────────────────┘  │
│          │ Prisma Client                                          │
└──────────┼───────────────────────────────────────────────────────┘
           │
┌──────────▼───────────────┐
│   PostgreSQL 16           │  ← indexes, constraints, cascades
└───────────────────────────┘
```

- **Reads** for pages go straight through typed domain libs (`src/lib/bi.ts`, etc.) inside
  Server Components — no API round-trip, minimal latency.
- **Mutations** go through versionable REST **route handlers** under `/api/*`, each wrapped by
  `withAuth(permission, handler)` for consistent authn/authz/validation/error handling.
- **Cross-cutting concerns** (audit logging, BI math, report building) are centralized in `lib/`.

---

## 3. Database schema

Normalized (3NF) PostgreSQL schema — full definition in [`prisma/schema.prisma`](./prisma/schema.prisma).

**Entities:** `User`, `PasswordResetToken`, `Department`, `Employee`, `Client`, `Project`,
`ProjectMember`, `Milestone`, `Task`, `ActivityLog`, `Notification`.

**Key relationships**
- `User 1—1 Employee` (auth identity separated from HR profile; the CEO is also an Employee row).
- `Department 1—* Employee`.
- `Client 1—* Project`; `Employee 1—* Project` as lead.
- `Project *—* Employee` via **`ProjectMember`** join table (with `roleInProject`, `allocationPct`).
- `Project 1—* Task`; `Employee 1—* Task` (assignee); `User 1—* Task` (assignedBy).
- `Project 1—* Milestone`.

**Constraints & integrity**
- Unique: `User.email`, `Department.name`, `ProjectMember(projectId, employeeId)`, `PasswordResetToken.tokenHash`.
- Cascades: deleting a `User` cascades to its `Employee`; deleting a `Project` cascades to members/tasks/milestones.
- `onDelete: SetNull` where history should survive (e.g. a deleted lead leaves the project intact).
- `Decimal(12,2)` for budgets; enums for all status/priority/role fields (DB-enforced domains).

**Indexing strategy (read-optimized for dashboards)**
- `Task(assigneeId, status)` composite — powers workload & "open tasks per employee".
- `Task(dueDate)`, `Project(deadline)` — overdue / upcoming-deadline scans.
- `Project(status)`, `Project(priority)`, `Employee(status)` — KPI counts & filters.
- `ActivityLog(entityType, entityId)` and `(createdAt)` — audit lookups.
- `Notification(userId, readAt)` — unread badge queries.

**Optimization techniques:** enum columns instead of lookup tables for fixed domains, composite
indexes matching query predicates, `groupBy`/`count` aggregations pushed to Postgres, and JSON
`metadata` on `ActivityLog` to avoid schema churn for audit detail.

---

## 4. Folder structure

```
wesualise/
├── prisma/
│   ├── schema.prisma          # normalized schema + indexes
│   └── seed.ts                # demo data (employees, projects, tasks, BI signals)
├── src/
│   ├── app/
│   │   ├── (app)/             # authenticated route group → AppShell layout
│   │   │   ├── dashboard/     # executive dashboard (KPIs, charts, risk)
│   │   │   ├── employees/     # list + CRUD client
│   │   │   ├── clients/
│   │   │   ├── projects/      # list + [id] detail
│   │   │   ├── tasks/         # status board
│   │   │   ├── reports/       # export hub
│   │   │   ├── settings/      # rules, departments, audit log
│   │   │   └── error.tsx      # 403 / error boundary
│   │   ├── api/               # REST route handlers (CRUD + auth + exports)
│   │   ├── login/ , reset-password/
│   │   ├── layout.tsx , globals.css   # design tokens (light/dark)
│   │   └── page.tsx           # → redirect /dashboard
│   ├── components/            # AppShell, providers, theme, ui/* primitives, dashboard/*
│   ├── lib/                   # prisma, auth, session, rbac, api, bi, reports, audit, validators, utils
│   ├── types/                 # next-auth module augmentation
│   └── middleware.ts          # protected-route gate
├── docker-compose.yml         # PostgreSQL 16
├── ARCHITECTURE.md , README.md
```

---

## 5. API design

RESTful route handlers, JSON, consistent envelopes and status codes. Every handler is wrapped by
`withAuth(permission, fn)` (`src/lib/api.ts`) which enforces authentication, the required
**permission**, Zod validation (`422` on failure) and uniform error mapping (`401/403/404/500`).

| Method & path | Permission | Purpose |
|---------------|-----------|---------|
| `GET/POST /api/employees` | `analytics:view-team` / `employee:manage` | List (search/filter) / create |
| `GET/PATCH/DELETE /api/employees/:id` | `analytics:view-team` / `employee:manage` | Read / update / remove |
| `GET/POST /api/clients`, `/api/clients/:id` | `analytics:view-team` / `client:manage` | Client CRUD |
| `GET/POST /api/projects`, `/api/projects/:id` | `analytics:view-team` / `project:manage-assigned` | Project CRUD + member set |
| `GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/:id` | `task:update-own` / `task:assign` | Task CRUD; employees scoped to own tasks |
| `GET /api/departments` | `task:update-own` | Department options |
| `GET /api/reports/:key/export?format=pdf\|xlsx\|csv` | `report:export` | Streamed file download |
| `POST /api/password/request`, `/reset` | public | Reset flow (enumeration-safe) |
| `* /api/auth/[...nextauth]` | public | Auth.js endpoints |

---

## 6. Authentication flow

1. User submits credentials to the NextAuth **Credentials provider** (`src/lib/auth.ts`).
2. Server looks up the `User`, verifies `isActive`, and compares the password with **bcrypt**.
3. On success an `auth.login` row is written to `ActivityLog`; a **JWT session** (8h) is issued
   carrying `id`, `role`, `employeeId`, `avatarUrl`.
4. `middleware.ts` gates every non-public route; unauthenticated requests redirect to `/login`.
5. **Password reset:** `POST /api/password/request` always returns 200 (no email enumeration),
   stores a bcrypt-hashed, 30-min, single-use token; `POST /api/password/reset` verifies and rotates the password.

Sessions are **stateless JWTs** (horizontal scaling, no session store). Trade-off vs DB sessions:
no server-side instant revocation — mitigated by short lifetime + `isActive` check.

---

## 7. Authorization flow (RBAC)

- A single **permission catalogue** (`src/lib/rbac.ts`) maps each `Role` → capabilities.
  Feature code checks **permissions**, never raw role strings.
- Roles: **Administrator** (all), **Team Lead** (assigned projects, task assignment, team analytics,
  exports), **Employee** (update own tasks only).
- Three enforcement layers:
  1. **Middleware** — authentication gate.
  2. **Server pages** — `requireCan(permission)` (`src/lib/session.ts`) redirects/`403`s.
  3. **API** — `withAuth(permission, …)` returns `403` before any DB work.
- **Row-level scoping** for employees: task `GET`/`PATCH` are constrained to `assigneeId === user.employeeId`.
- The **navigation** itself is permission-filtered, so users never see actions they cannot perform.

---

## 8. Dashboard implementation plan

- KPIs, charts and risk are computed server-side in the **BI engine** (`src/lib/bi.ts`) and rendered
  by the RSC page `app/(app)/dashboard/page.tsx`; only chart leaves are client components.
- **10 KPIs:** totals, active/completed/delayed projects, unassigned & multi-project employees,
  tasks done today, overdue, deadlines in 7 days.
- **Charts (Recharts):** 14-day completion trend (line), team-utilization radial gauge, project-status
  pie, per-employee workload bars, department performance (stacked). Accessible palette, tooltips,
  reduced-motion respected, semantic chart tokens.
- **Risk feed:** delayed projects, overloaded employees, approaching deadlines, resource shortages —
  severity-sorted.
- Counts use Postgres `count`/`groupBy`; promise-parallelized with `Promise.all` for fast loads.

---

## 9. Component hierarchy

```
RootLayout (Providers: SessionProvider + ThemeProvider)
└── (app)/layout  → requireUser() → AppShell(sidebar+topbar, dark-mode toggle, sign-out)
    ├── DashboardPage → KpiCard ×10 · charts/* · RiskFeed
    ├── EmployeesPage → EmployeesClient → Table · Modal(form) · Badge/Avatar
    ├── ClientsPage   → ClientsClient
    ├── ProjectsPage  → ProjectsClient(cards+health) → ProjectDetail([id])
    ├── TasksPage     → TasksClient(status board) → Select(status), Modal(create)
    ├── ReportsPage   → ReportsClient(export buttons)
    └── SettingsPage  → rules · departments · audit table
ui/primitives: Button, Card, Badge, Input, Select, Textarea, Label, Avatar
ui/: Modal (accessible: scrim, Esc, scroll-lock), Table
```

Server Components own data fetching; small Client Components own interactivity (forms, board, theme).

---

## 10. Development roadmap

| Phase | Scope |
|-------|-------|
| **0 — Foundation** ✅ | Stack, schema, auth, RBAC, design system, app shell |
| **1 — Core CRUD** ✅ | Employees, clients, projects, tasks, departments |
| **2 — Intelligence** ✅ | Dashboard, BI engine, risk detection, reports & exports |
| **3 — Collaboration** | Comments/work-update threads on tasks, file attachments (S3-compatible), in-app + email notifications |
| **4 — Planning** | Drag-and-drop kanban, Gantt timeline, capacity planning, time-tracking timers |
| **5 — Hardening** | Migrations in CI, e2e tests (Playwright), rate limiting, observability (OpenTelemetry), 2FA |

---

## 11. Deployment strategy

- **Recommended:** Vercel (app) + managed Postgres (Neon/Supabase/Railway). Push-to-deploy, preview
  envs per PR, automatic TLS & CDN.
- **Alternative (full control / lowest cost):** single VPS with `docker compose` (Next.js + Postgres)
  behind Caddy/Nginx for TLS.
- **Build:** `npm run build` runs `prisma generate` then `next build`. Run `prisma migrate deploy`
  on release. Health via `/dashboard` behind auth; add `/api/health` for probes in Phase 5.
- **Config** via env vars (`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `WORKLOAD_THRESHOLD`).

---

## 12. Security recommendations

- **Passwords:** bcrypt (cost 10); never stored or logged in plaintext.
- **Sessions:** short-lived JWTs, HTTP-only cookies (NextAuth default), `NEXTAUTH_SECRET` rotation.
- **AuthZ:** centralized permission matrix, enforced at middleware + page + API layers; row-level
  scoping for employees.
- **Input validation:** Zod on every mutation → rejects malformed/oversized payloads.
- **SQL injection:** eliminated by Prisma parameterized queries.
- **Audit trail:** append-only `ActivityLog` for logins, CRUD and exports.
- **Enumeration-safe** password reset; single-use, hashed, expiring tokens.
- **Next steps:** rate limiting on auth endpoints, security headers/CSP, 2FA for Admins, secret
  management (Vault/SSM), dependency scanning (Dependabot), PITR backups (below).

---

## 13. Scalability considerations

- **Stateless app tier** → scale horizontally behind a load balancer; JWT sessions need no sticky state.
- **Database** → start single-node; add **read replicas** for analytics, connection pooling
  (PgBouncer/Prisma Accelerate) under load.
- **Query design** → composite indexes match dashboard predicates; aggregations run in Postgres.
- **Caching** → add Redis + Next.js segment caching / `revalidate` for KPI snapshots when traffic grows.
- **Heavy reports** → move large exports to a background job queue (BullMQ) in Phase 5.
- **Media** → store avatars/attachments in object storage (S3/R2), served via CDN, not the DB.

**Backup strategy:** managed Postgres automated daily snapshots + point-in-time recovery (WAL);
for self-hosted, nightly `pg_dump` to off-site object storage with 30-day retention and periodic
restore drills.

---

## 14. Future enhancements

- Task comment threads, @mentions and activity feed per project.
- Email/Slack notifications and a digest for the CEO.
- Gantt timeline, drag-and-drop kanban, live time-tracking.
- Client-facing read-only project portal.
- AI assist: deadline-risk prediction, auto workload balancing, natural-language report queries.
- Mobile app (the design tokens already map cleanly to React Native) and PWA offline mode.
- SSO (Google Workspace) + 2FA; granular custom roles.
