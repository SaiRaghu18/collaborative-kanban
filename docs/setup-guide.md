# Beginner's Guide: Setting Up and Running KanbanFlow

Welcome! If you have never programmed before or this is your first time setting up a web application, this guide is written specifically for you in simple, clear steps.

---

## 🛠️ Step 1: Install Node.js

You will need Node.js installed on your computer:
- Download from: [nodejs.org](https://nodejs.org/) (Choose LTS version).

---

## ⚡ Step 2: Connect to Your Existing Supabase Database

You do NOT need to install PostgreSQL locally! We connect directly to your cloud-hosted Supabase database.

1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Click on your project.
3. In the left navigation, click **Project Settings** (⚙️) ➔ **Database** (or click the green **Connect** button at the top).
4. Scroll to **Connection string** and select the **URI** tab.
5. Grab the two connection strings:
   - **DATABASE_URL (Transaction Pooler - Port 6543)**:
     Select `Mode: Transaction`. Add `?pgbouncer=true` at the end.
     ```
     postgresql://postgres.[PROJECT_REF]:[YOUR_PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
     ```
   - **DIRECT_URL (Direct Connection - Port 5432)**:
     Select `Direct connection` or Session pooler on Port 5432.
     ```
     postgresql://postgres:[YOUR_PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
     ```
6. **Important URL Encoding**: If your database password contains special characters (like `@`, `#`, `$`, `%`, `&`), encode them so the connection URL doesn't break:
   - `@` ➔ `%40` (e.g. `12@pass` becomes `12%40pass`)
   - `#` ➔ `%23`
   - `$` ➔ `%24`

---

## ⚙️ Step 3: Configure Environment Variables

1. Navigate to the `backend/` folder.
2. Open the `.env` file (or copy `.env.example` to `.env`):
   ```env
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/kanban_db?schema=public"
   JWT_SECRET="dev_secret_key_change_in_production_min_64_characters_kanban_flow_secure_token"
   PORT=4000
   NODE_ENV="development"
   FRONTEND_URL="http://localhost:5173"
   BCRYPT_SALT_ROUNDS=12
   ```
   *Replace `YOUR_PASSWORD` with the actual password you created when installing PostgreSQL.*

---

## 🚀 Step 4: Run Database Migrations & Seeds

From the `backend` folder, run:
```bash
# Apply schema to database
npx prisma migrate dev --name init

# (Optional) Seed initial data (Org, Tenants, Admin user)
npm run seed
```

---

## 💻 Step 5: Start the Backend Server

Open a terminal window and run:
```bash
cd backend
npm run dev
```
You will see:
```
⚡ Server running on http://localhost:4000
🔌 Socket.IO initialized and ready
📡 Health check: http://localhost:4000/api/health
```

---

## 🌐 Step 6: Start the Frontend Application

Open a **second** terminal window and run:
```bash
cd frontend
npm run dev
```
You will see:
```
  VITE v6.0.1  ready in 200 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```
Now open your browser and navigate to: **`http://localhost:5173`**!
You will see the login page. You can register a new account or sign in with your seeded administrator account.
