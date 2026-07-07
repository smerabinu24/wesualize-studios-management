# Wesualize Studio Management System

Internal SaaS-style management platform for **Wesualize**, an animation & creative studio.
Gives the CEO, team leads and employees real-time visibility into projects, tasks, workload,
utilization and risk.

> **Architecture & design rationale:** see [ARCHITECTURE.md](./ARCHITECTURE.md) for the full
> 14-part breakdown (stack justification, schema, API design, auth/authz flows, roadmap,
> deployment, security, scalability).

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 (App Router, React Server Components, TypeScript) |
| UI | Tailwind CSS + custom design-token component library, Lucide icons |
| Charts | Recharts |
| Auth | Auth.js (NextAuth) — credentials + JWT sessions, RBAC |
| ORM / DB | Prisma + PostgreSQL |
| Exports | ExcelJS (xlsx), PapaParse (csv), pdf-lib (pdf) |
| Validation | Zod |

Design system generated with **ui-ux-pro-max** → *"Data-Dense Dashboard"* style,
professional blue (`#2563EB`) + green (`#059669`), Fira Sans / Fira Code, full light & dark mode.

---

## Quick start

```bash
# 1. Start PostgreSQL (Docker)
docker compose up -d

# 2. Configure env
cp .env.example .env        # defaults already match docker-compose

# 3. Install deps
npm install

# 4. Create schema + seed demo data
npm run db:push
npm run db:seed

# 5. Run
npm run dev                 # http://localhost:3000
```

> No Docker? Point `DATABASE_URL` at any PostgreSQL instance and run steps 3–5.

### Demo accounts (password: `Password123!`)

| Email | Role |
|-------|------|
| `admin@wesualize.com` | Administrator (CEO) |
| `lead@wesualize.com` | Team Lead |
| `ana@wesualize.com` | Employee |

---

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Production build (runs `prisma generate`) |
| `npm run db:push` | Sync schema to DB (no migration history) |
| `npm run db:migrate` | Create a dev migration |
| `npm run db:seed` | Seed demo data |
| `npm run db:reset` | Drop, re-migrate and re-seed |
| `npm run db:studio` | Prisma Studio (DB browser) |

---

## Feature map

- **Auth & security** — credentials login, 8h JWT sessions, password reset, RBAC, audit log, route middleware.
- **Executive dashboard** — 10 live KPIs, completion trend, utilization gauge, status/workload/department charts, risk feed.
- **Employees** — CRUD, search/filter, per-employee workload & overload/unassigned flags.
- **Clients** — CRUD, project counts.
- **Projects** — CRUD, health score, members, milestones, timeline, detail view.
- **Tasks** — board by status, inline status updates, assignment, time tracking, notifications.
- **Reports** — 6 reports exportable to PDF / Excel / CSV.
- **Smart BI** — unassigned & overloaded detection, project health score, team utilization, risk detection.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for how each is implemented.
