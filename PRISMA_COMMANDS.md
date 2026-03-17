# Prisma Commands Reference

A quick-reference guide for Prisma CLI commands you'll use regularly in DreamCrafters.

---

## 🔧 Setup & Generation

### `npx prisma generate`
**Generates the Prisma Client** based on your `schema.prisma` file.

**When to use:**
- After cloning the repo for the first time
- After changing `schema.prisma` (adding/modifying models)
- After running `npm install`

```powershell
npx prisma generate
```

---

### `npx prisma init`
**Initializes Prisma** in a new project. Creates `prisma/schema.prisma` and `.env`.

```powershell
npx prisma init --datasource-provider postgresql
```

> You don't need this — it's already set up.

---

## 📦 Migrations

### `npx prisma migrate dev`
**Creates and applies a migration** in development. This is the main command you'll use.

**When to use:**
- After changing `schema.prisma` (adding tables, columns, relations)
- It creates a migration SQL file, applies it, and re-generates the client

```powershell
# With a descriptive name
npx prisma migrate dev --name added_notifications_table

# Without a name (Prisma will prompt you)
npx prisma migrate dev
```

---

### `npx prisma migrate reset`
**Drops the entire database**, recreates it, and applies all migrations from scratch.

**When to use:**
- When you want a fresh start
- When migrations get messy during development
- Runs seed script if you have one

```powershell
npx prisma migrate reset
```

> ⚠️ **WARNING**: This deletes ALL data in the database!

---

### `npx prisma migrate deploy`
**Applies pending migrations** in production. Does NOT generate new migrations.

**When to use:**
- In CI/CD pipelines
- When deploying to production

```powershell
npx prisma migrate deploy
```

---

### `npx prisma migrate status`
**Shows the status** of all migrations (applied, pending, failed).

```powershell
npx prisma migrate status
```

---

## 🔄 Database Push (No Migration Files)

### `npx prisma db push`
**Pushes schema changes directly** to the database without creating migration files.

**When to use:**
- During rapid prototyping
- When you don't care about migration history
- For quick schema experiments

```powershell
npx prisma db push
```

> 💡 Use `migrate dev` for anything you want tracked in version control.

---

## 🔍 Introspection & Inspection

### `npx prisma db pull`
**Introspects an existing database** and updates `schema.prisma` to match.

**When to use:**
- When someone changed the DB directly (not recommended)
- When reverse-engineering an existing database

```powershell
npx prisma db pull
```

---

### `npx prisma studio`
**Opens Prisma Studio** — a visual database browser in your browser.

**When to use:**
- To view/edit/delete data visually
- For debugging — quick way to check what's in the DB

```powershell
npx prisma studio
```

Opens at `http://localhost:5555` by default.

---

## ✅ Validation & Formatting

### `npx prisma validate`
**Validates** the `schema.prisma` file for syntax errors.

```powershell
npx prisma validate
```

---

### `npx prisma format`
**Formats** the `schema.prisma` file (auto-indentation, sorting).

```powershell
npx prisma format
```

---

## 🌱 Seeding

### `npx prisma db seed`
**Runs the seed script** defined in `package.json` to populate the database with initial data.

**Setup**: Create a `prisma/seed.js` file:

```javascript
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const hashedPassword = await bcrypt.hash('DC_Admin!123', 12);
  await prisma.user.upsert({
    where: { email: 'admin@dreamcrafters.com' },
    update: {},
    create: {
      name: 'System Administrator',
      email: 'admin@dreamcrafters.com',
      username: 'DC_Admin',
      passwordHash: hashedPassword,
      role: 'admin',
      isVerified: true,
    },
  });
  console.log('Seed complete');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

Then add to `package.json`:
```json
"prisma": {
  "seed": "node prisma/seed.js"
}
```

Run it:
```powershell
npx prisma db seed
```

---

## 🧑‍💻 Common Workflows

### Starting Fresh (Day 1)
```powershell
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

### After Pulling New Schema Changes
```powershell
npm install
npx prisma generate
npx prisma migrate dev
```

### After Modifying `schema.prisma`
```powershell
npx prisma migrate dev --name describe_what_changed
```

### Viewing Your Data
```powershell
npx prisma studio
```

### Nuking Everything & Starting Over
```powershell
npx prisma migrate reset
```

---

## 📋 Quick Cheat Sheet

| Command | What it does |
|---------|-------------|
| `prisma generate` | Build the query client from schema |
| `prisma migrate dev` | Create + apply migration (dev) |
| `prisma migrate deploy` | Apply migrations (production) |
| `prisma migrate reset` | Drop DB + reapply all migrations |
| `prisma migrate status` | Check migration status |
| `prisma db push` | Push schema without migration files |
| `prisma db pull` | Pull DB schema into `schema.prisma` |
| `prisma db seed` | Run seed script |
| `prisma studio` | Visual DB editor (browser) |
| `prisma validate` | Check schema syntax |
| `prisma format` | Auto-format schema file |
