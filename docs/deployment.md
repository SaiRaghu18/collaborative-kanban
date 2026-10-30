# KanbanFlow Production Deployment Guide

A step-by-step guide designed for complete beginners to deploy **KanbanFlow** to production on **Supabase** (Database), **Render** (Backend API & WebSockets), and **Vercel** (Frontend React Application).

---

## Architecture Overview

```
┌─────────────────────────────────┐
│     Vercel (React Frontend)     │
│  https://your-kanban.vercel.app │
└───────────────┬─────────────────┘
                │
                │ HTTPS (REST API) & WSS (WebSockets)
                ▼
┌─────────────────────────────────┐
│     Render (Node.js API)        │
│  https://your-api.onrender.com  │
└───────────────┬─────────────────┘
                │
                │ PostgreSQL (Port 6543 / 5432)
                ▼
┌─────────────────────────────────┐
│   Supabase (Hosted Database)    │
│  aws-0-region.pooler.supabase   │
└─────────────────────────────────┘
```

---

## Part 1: Database Setup (Supabase PostgreSQL)

Your database is already hosted on Supabase! Here is how connection strings work:

### 1. Pooler vs. Direct URL
- **Transaction Pooler (`DATABASE_URL`, Port 6543)**:
  - Used by the Node.js backend application to handle hundreds of concurrent collaborator queries without exhausting database connection limits.
  - Suffix: `?pgbouncer=true`
  - Example: `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true`
- **Direct Connection (`DIRECT_URL`, Port 5432)**:
  - Used exclusively during database migrations (`prisma migrate deploy` or `prisma db push`).
  - Example: `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

---

## Part 2: Backend Deployment (Render)

Render is ideal for Node.js Web Services that support persistent WebSocket connections (Socket.IO).

### Step 1: Create a Web Service on Render
1. Log in to [dashboard.render.com](https://dashboard.render.com).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. Select the repository and configure the following settings:
   - **Name**: `kanbanflow-api`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**:
     ```bash
     npm install && npx prisma generate && npm run build
     ```
   - **Start Command**:
     ```bash
     npm run start
     ```
   - **Instance Type**: Free or Starter

### Step 2: Configure Backend Environment Variables
In the Render service settings, open the **Environment** tab and add:

| Key | Value / Description | Example |
|---|---|---|
| `NODE_ENV` | `production` | `production` |
| `PORT` | `4000` | `4000` |
| `DATABASE_URL` | Your Supabase pooled connection string (Port 6543) | `postgresql://...:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | Your Supabase direct connection string (Port 5432) | `postgresql://...:5432/postgres` |
| `JWT_SECRET` | A secure, random 64-character string | Generate via terminal: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_EXPIRES_IN` | Token duration | `7d` |
| `BCRYPT_SALT_ROUNDS` | Password encryption rounds | `12` |
| `FRONTEND_URL` | Your Vercel frontend URL (can update after deploying Vercel) | `https://your-kanban.vercel.app` |

### Step 3: Verify Backend Health
Once deployed, verify your backend API by opening in your browser:
```
https://your-api.onrender.com/api/health
```
You should receive:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "database": "healthy",
    "uptimeSeconds": 24,
    "environment": "production",
    "version": "1.0.0"
  }
}
```

---

## Part 3: Frontend Deployment (Vercel)

Vercel provides edge delivery and global CDN acceleration for Vite React applications.

### Step 1: Import Project to Vercel
1. Log in to [vercel.com](https://vercel.com).
2. Click **Add New...** -> **Project**.
3. Import your GitHub repository.
4. In the project setup screen:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click "Edit" and choose `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### Step 2: Configure Frontend Environment Variables
In the **Environment Variables** section, add:

| Key | Value |
|---|---|
| `VITE_API_URL` | Your deployed Render API URL, e.g. `https://your-api.onrender.com` |
| `VITE_WS_URL` | Your deployed Render WebSocket URL, e.g. `https://your-api.onrender.com` |

### Step 3: Deploy
1. Click **Deploy**. Vercel will build the frontend chunks and deploy globally.
2. The included [vercel.json](file:///c:/Users/pudis/OneDrive/Desktop/collaborative-kanban/frontend/vercel.json) ensures client-side routes (e.g. `/dashboard/boards/123`) refresh smoothly without 404 errors.
3. Copy your live Vercel domain (e.g., `https://kanbanflow-demo.vercel.app`).
4. In Render, update `FRONTEND_URL` to match your Vercel domain so CORS and WebSockets allow the connection!

---

## Part 4: Multi-Server Horizontal Scaling (Optional Redis Adapter)

In single-instance deployments (standard Render/Railway setup), Socket.IO manages rooms in memory via Node.js events.

### Why Redis is Needed for Multi-Instance Deployments
When you scale your backend horizontally to 2 or more server instances behind a load balancer:
- User A might be connected to Server 1.
- User B might be connected to Server 2.
- A card move broadcast on Server 1 would not reach User B unless the servers communicate through a shared pub/sub message broker like **Redis**.

### How to Enable the Socket.IO Redis Adapter in the Future:
1. Spin up a managed Redis instance (e.g. Upstash Redis, Redis Cloud, or Render Redis).
2. Install the adapter in `backend`:
   ```bash
   npm install @socket.io/redis-adapter ioredis
   ```
3. In `backend/src/config/socket.ts`:
   ```ts
   import { createAdapter } from '@socket.io/redis-adapter';
   import { Redis } from 'ioredis';

   if (process.env.REDIS_URL) {
     const pubClient = new Redis(process.env.REDIS_URL);
     const subClient = pubClient.duplicate();
     io.adapter(createAdapter(pubClient, subClient));
     console.log('[Socket.IO] Redis adapter enabled for multi-instance clustering.');
   }
   ```
4. For single-server deployments (such as internship submissions or early startups), the in-memory architecture is faster and avoids extra hosting costs.
