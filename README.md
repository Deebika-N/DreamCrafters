# DreamCrafters

A full-stack learning platform with AI study planning, career guidance, mentoring, and job listings.

**Stack**: Express.js + PostgreSQL (Prisma) | Vite (React) frontend

---

## Prerequisites

- **Node.js** v18+
- **PostgreSQL** v14+ (see [PostgreSQL Setup](#postgresql-setup) below)
- **npm** v9+

---

## PostgreSQL Setup

> **You need to do this before running the backend.**

### Step 1: Install PostgreSQL

**Windows** — Download from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/) and run the installer.

During installation:
- Set a **password** for the `postgres` superuser (remember this!)
- Keep the default **port** `5432`
- The installer includes **pgAdmin** (GUI tool) and **psql** (CLI tool)

### Step 2: Create the Database

Open **pgAdmin** or **psql** and create a new database:

```sql
-- Using psql (open from Start Menu → "SQL Shell (psql)")
-- Login with the password you set during installation

CREATE DATABASE dreamcrafters;
```

Or in **pgAdmin**: Right-click "Databases" → "Create" → "Database" → Name it `dreamcrafters`.

### Step 3: Update the `.env` File

Edit `backend/.env` and set your `DATABASE_URL`:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/dreamcrafters?schema=public"
```

Replace `YOUR_PASSWORD` with the password you set during PostgreSQL installation.

**Format**: `postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE?schema=public`

---

## Getting Started

### 1. Backend Setup

```powershell
cd backend

# Install dependencies (installs Prisma + all packages)
npm install

# Generate Prisma Client (creates the DB query engine)
npx prisma generate

# Run database migrations (creates all tables in PostgreSQL)
npx prisma migrate dev --name init

# Start the dev server
npm run dev
```

### 2. Frontend Setup

```powershell
cd frontend

npm install
npm run dev
```

The frontend runs at `http://localhost:5173` and expects the backend API at `http://localhost:5000/api`.

Set `VITE_API_URL` in `frontend/.env` to change the API URL.

---

## Project Structure

```
DreamCrafters/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma      # Database schema (30+ tables)
│   ├── lib/
│   │   └── prisma.js           # Prisma client singleton
│   ├── controllers/            # Route handlers (TODO: rewrite for Prisma)
│   ├── middleware/
│   │   └── auth.js             # JWT auth middleware (uses Prisma)
│   ├── routes/                 # Express routes
│   ├── utils/
│   │   └── email.js            # Email OTP service
│   ├── .env                    # Environment variables
│   ├── package.json
│   └── server.js               # Express server entry point
├── frontend/                   # Vite + React app
├── PRISMA_COMMANDS.md          # Prisma CLI reference
└── README.md
```

---

## Available Backend Scripts

| Command                | Description                                  |
|------------------------|----------------------------------------------|
| `npm run dev`          | Start dev server with hot-reload (nodemon)   |
| `npm start`            | Start production server                      |
| `npm run prisma:generate` | Generate Prisma Client after schema changes |
| `npm run prisma:migrate`  | Create and apply database migrations        |
| `npm run prisma:studio`   | Open Prisma Studio (visual DB browser)      |
| `npm run prisma:push`     | Push schema to DB without migration files   |

---

## Useful Links

- [Prisma Docs](https://www.prisma.io/docs)
- [PostgreSQL Downloads](https://www.postgresql.org/download/)
- [Prisma Commands Reference](./PRISMA_COMMANDS.md)
