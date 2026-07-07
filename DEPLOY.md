# Deploying Wesualize Studios to Vercel + Neon (free)

One-time setup. After this, every `git push` to `main` auto-deploys.

---

## 1. Create the database (Neon — free)

1. Go to **https://neon.tech** → sign up (free) → **Create project**.
2. After it's created, open **Connection Details** and copy **two** strings:
   - **Pooled** connection string — the host contains `-pooler`. → this is `DATABASE_URL`
   - **Direct** connection string — the host has **no** `-pooler`. → this is `DIRECT_URL`
   - Both end with `?sslmode=require`. Keep that.
3. To the **pooled** one (`DATABASE_URL`) add `&pgbouncer=true` at the end, e.g.
   `postgresql://user:pass@ep-xxx-pooler.../db?sslmode=require&pgbouncer=true`

> Neon free tier easily handles ~100 users.

---

## 2. Generate an auth secret

Run locally and copy the output:
```bash
openssl rand -base64 32
```
(That value becomes `NEXTAUTH_SECRET`.)

---

## 3. Import the repo into Vercel

1. Go to **https://vercel.com** → sign up with GitHub → **Add New… → Project**.
2. Pick **`wesualize-studios-management`** → **Import**.
3. Framework is auto-detected as **Next.js** — leave build settings default
   (our `build` script already runs `prisma migrate deploy`).
4. **Before deploying**, open **Environment Variables** and add these four:

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | Neon **pooled** string (+ `&pgbouncer=true`) |
   | `DIRECT_URL` | Neon **direct** string |
   | `NEXTAUTH_SECRET` | the value from step 2 |
   | `WORKLOAD_THRESHOLD` | `6` |

   (Leave `NEXTAUTH_URL` out for now — add it in step 5.)
5. Click **Deploy**. The build runs migrations against Neon and creates all tables.

---

## 4. Create your admin account on the live database

The live Neon DB is empty. From your PC, create the first admin against it:

```bash
# temporarily point at Neon (use the DIRECT url), then run clean-start
# PowerShell:
$env:DATABASE_URL="<neon DIRECT url>"; npm run db:clean
```
This creates `imsidbinu@gmail.com` / `Password123!` on the production database.
(Or add a one-off Vercel script later — this manual run is simplest once.)

---

## 5. Set the site URL and redeploy

1. In Vercel, note your URL (e.g. `https://wesualize-studios-management.vercel.app`).
2. Add one more env var:

   | Name | Value |
   |------|-------|
   | `NEXTAUTH_URL` | your Vercel URL (https://…) |

3. **Redeploy** (Vercel → Deployments → ⋯ → Redeploy) so login uses the right URL.

---

## 6. Go live

- Open your Vercel URL → sign in as admin → add real employees/clients/projects.
- Optional: add a **custom domain** in Vercel → Settings → Domains.

---

## Updating later
Just `git push` to `main`. Vercel rebuilds, runs any new migrations, and redeploys automatically.

## Schema changes (for developers)
When you change `prisma/schema.prisma`, create a migration locally:
```bash
npx prisma migrate dev --name describe_change
git add prisma/migrations && git commit && git push
```
Vercel applies it on deploy via `prisma migrate deploy`.
