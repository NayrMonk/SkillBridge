# SkillBridge — Production-Ready Freelance Marketplace

## Quick Start

### Prerequisites
- **Node.js 18+** — https://nodejs.org
- **PostgreSQL 14+** — https://www.postgresql.org/download
- **Redis** — https://redis.io/download (Windows: https://github.com/tporadowski/redis/releases)

---

### Step 1 — Create the database

```bash
# Connect to PostgreSQL (enter your postgres password when prompted)
psql -U postgres

# Inside psql:
CREATE DATABASE skillbridge;
\q

# Load the schema
psql -U postgres -d skillbridge -f server/database/schema.sql
```

---

### Step 2 — Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=skillbridge
DB_USER=postgres
DB_PASSWORD=your_postgres_password

REDIS_URL=redis://localhost:6379

JWT_SECRET=any-long-random-string-change-in-production-abc123xyz789

# Get free Stripe test keys at stripe.com/dashboard → Developers → API Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

CLIENT_URL=http://localhost:5173
PORT=3001
NODE_ENV=development
```

---

### Step 3 — Install dependencies

```bash
npm install
```

---

### Step 4 — Run (two terminals)

**Terminal 1 — Backend API:**
```bash
npx nodemon server/index.ts
```
Runs at: http://localhost:3001

**Terminal 2 — Frontend:**
```bash
npm run dev
```
Runs at: http://localhost:5173

---

### Open in browser
```
http://localhost:5173
```

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `ECONNREFUSED 5432` | PostgreSQL not running. Start it: `brew services start postgresql@15` (Mac) or open Services (Windows) |
| `ECONNREFUSED 6379` | Redis not running. Start it: `brew services start redis` (Mac) or run `redis-server.exe` (Windows) |
| `relation "users" does not exist` | Schema not loaded. Run: `psql -U postgres -d skillbridge -f server/database/schema.sql` |
| `Cannot find module` | Run `npm install` again |
| `Port 3001 in use` | Change `PORT=3002` in `.env` |

---

## Design System — Deep Forest

The UI uses the **Deep Forest** design system:
- **Primary color:** `#1A6B47` (forest green)
- **Sidebar:** `#0E1B14` (very dark forest)
- **Canvas:** `#F4F6F4` (warm off-white)
- **Fonts:** Instrument Serif (headings) + Plus Jakarta Sans (body)

---

## Features

- **AI Skill Assessments** — Claude-powered technical interviews
- **Custom Client Tests** — Multiple choice, true/false, short answer
- **Escrow Payments** — Stripe-powered milestone-based payments
- **Real-time Messaging** — Socket.io powered chat
- **Project Promotions** — Hot (🔥) and Featured (⭐) paid boosts
- **Admin Dashboard** — Full platform management
- **Wallet System** — Client deposits, freelancer withdrawals
- **Role-based Access** — Freelancer / Client / Admin
