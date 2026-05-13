# Migration Guide

How to move from the original browser-only build to the SaaS schema, and how to ship the SQLite-backed development app to production Postgres without rewriting anything.

## 1. From browser-only to database-backed

Before the SaaS work, every saved template lived in `localStorage` under the key `email-builder:user-templates:v3`. Each browser kept its own copy and nothing was shared.

After the change:

- The original key is no longer read on the page. The editor calls `loadUserTemplates()` (`lib/userTemplates.ts`) which now hits `/api/templates`, which is workspace-scoped on the server.
- The function signature is unchanged, so existing callers in `components/TopBar.tsx` didn't have to be rewritten — only the implementation moved.
- If a user has unshipped templates in their browser, they're not lost; they're just no longer surfaced. Use the one-time migration snippet below to push them up to the server.

### One-time migration of existing localStorage templates

Anyone who used the old build before this commit can copy their saved templates into the new DB by pasting this in the browser console while signed in:

```js
(async () => {
  const raw = localStorage.getItem("email-builder:user-templates:v3");
  if (!raw) return console.log("nothing to migrate");
  const list = JSON.parse(raw);
  for (const t of list) {
    const r = await fetch("/api/templates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: t.name, doc: t.doc }),
    });
    console.log(t.name, r.status);
  }
  console.log("done");
})();
```

The endpoint enforces "save-as-new" (name-collision handling), so re-running this is safe — it just appends ` (2)` to duplicates.

## 2. Applying the Phase-1 schema

The expanded `prisma/schema.prisma` adds 13 new tables (template_versions, contacts, lists, contact_lists, tags, contact_tags, campaigns, campaign_recipients, email_events, forms, form_submissions, media, activity_logs). To apply them locally:

```bash
cd ~/Desktop/emailer-builder
npx prisma generate     # regenerate client
npx prisma db push      # apply schema to SQLite
```

`db push` is the right command in dev because it preserves data already in `prisma/dev.db` (your users, teams, templates won't be wiped). It does **not** record a migration in `prisma/migrations/`. When you're ready to lock things down for production, switch to `prisma migrate dev --name <description>` so the schema change is committed as an SQL migration.

Verify with:

```bash
npx prisma studio
```

You should see the User, Team, Template, Contact, List, Tag, Campaign, Form, Media, ActivityLog tables (among others). The new ones will be empty.

## 3. SQLite → Postgres for production

Both providers run the schema as-is. The provider switch is two changes:

`prisma/schema.prisma`:

```diff
 datasource db {
-  provider = "sqlite"
+  provider = "postgresql"
   url      = env("DATABASE_URL")
 }
```

`.env`:

```diff
-DATABASE_URL="file:./dev.db"
+DATABASE_URL="postgresql://USER:PASS@HOST:5432/DB?schema=public"
```

Then in the production environment:

```bash
npx prisma migrate deploy   # apply committed migrations
npm run prisma:seed         # optional: seed an admin
```

### JSON columns

The schema stores rich payloads (`Template.doc`, `Form.config`, `Contact.attributes`, etc.) as `String` so the same code works on SQLite. The route handlers `JSON.stringify` on write and `JSON.parse` on read via `parseJson()` in `lib/workspace.ts`. When you move to Postgres you can optionally promote these to native `Json` columns:

1. Change the column type to `Json` in `schema.prisma`.
2. Drop the `JSON.stringify` / `JSON.parse` calls at the route boundary.
3. Run a migration that casts the column.

This is purely an optimisation — the string-as-JSON path works fine on Postgres too.

### Enums

The schema uses `String` with documented allowed values (e.g. `Membership.role`, `Campaign.status`) because SQLite doesn't support Prisma enums. On Postgres you can promote these to real enums for stricter validation:

```prisma
enum CampaignStatus { DRAFT SCHEDULED SENDING SENT FAILED CANCELED }
```

Again, optional — the app code only ever writes the documented values, so storing them as strings is safe today.

## 4. Data backup before migrating

For SQLite, the entire database is `prisma/dev.db`. Back it up with:

```bash
cp prisma/dev.db prisma/dev.db.backup-$(date +%F)
```

For Postgres, use `pg_dump`:

```bash
pg_dump $DATABASE_URL > backup-$(date +%F).sql
```

## 5. Rollback

If a `db push` produces a schema you don't want, revert `prisma/schema.prisma` to the previous commit and run `npx prisma db push` again. SQLite will adjust the schema; data in dropped columns is lost. That's why backing up `dev.db` first is part of the workflow.

For migrations created with `prisma migrate dev` in a production-bound branch, treat them like database code — once shipped, write a *new* migration to undo, never edit an applied one.
