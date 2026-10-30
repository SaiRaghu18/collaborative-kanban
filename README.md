# 🗂️ KanbanFlow — Real-Time Collaborative Multi-Tenant Kanban SaaS

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![Tests](https://img.shields.io/badge/tests-22%20passed-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![React](https://img.shields.io/badge/React-18-blue)
![Node.js](https://img.shields.io/badge/Node.js-20-green)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-black)
![Prisma](https://img.shields.io/badge/Prisma-5.22-darkblue)
![Database](https://img.shields.io/badge/PostgreSQL-Supabase-teal)

A production-ready, full-stack **Real-Time Collaborative Kanban Board** designed for modern organizations and enterprise teams. Built with a multi-tenant architecture, strict data isolation, optimistic concurrency control, and zero-latency live synchronization using Socket.IO.

---

## 📑 Table of Contents
1. [Project Overview](#-project-overview)
2. [Key Features](#-key-features)
3. [Technology Stack](#-technology-stack)
4. [System Architecture](#-system-architecture)
5. [Visual Preview & UI Highlights](#-visual-preview--ui-highlights)
6. [Multi-Tenant Data Hierarchy](#-multi-tenant-data-hierarchy)
7. [Real-Time Collaboration Engine](#-real-time-collaboration-engine)
8. [Security & Concurrency Controls](#-security--concurrency-controls)
9. [Prerequisites & Installation](#-prerequisites--installation)
10. [Environment Variables](#-environment-variables)
11. [Development Commands](#-development-commands)
12. [Automated Testing Suite](#-automated-testing-suite)
13. [Deployment Guide](#-deployment-guide)
14. [Documentation Index](#-documentation-index)
15. [Internship Evaluator Submission Notes](#-internship-evaluator-submission-notes)

---

## 🌟 Project Overview

**KanbanFlow** provides cross-functional teams with a high-performance workspace to organize tasks, balance sprint workloads, and collaborate in real time. Unlike simple proof-of-concept Kanban boards, KanbanFlow enforces **enterprise multi-tenancy**:
- Multiple organizations, multiple workspaces per organization, and multiple boards per workspace.
- **Zero data leakage**: Users from Workspace A can never view, query, or receive WebSocket broadcasts from Workspace B.
- **Live synchronization**: When User A moves a task or adds a column, User B sees the card move smoothly across their screen with live collaborator presence indicators.

---

## 🚀 Key Features

### 🏢 Multi-Tenant & Multi-Organization Architecture
- **Enterprise Hierarchy**: Organization -> Tenant (Workspace) -> Board -> Column -> Task.
- **Role-Based Access Control (RBAC)**: `ORG_ADMIN`, `TENANT_ADMIN`, and `MEMBER` roles with granular permission checks.
- **Workspace Switcher**: Instant switching between organizations and workspaces with persistent state.

### 📋 Full-Featured Kanban Board
- **Smooth Drag-and-Drop**: Built using `@dnd-kit` with keyboard and pointer activation constraints.
- **Column Management**: Create, rename, reorder, and safely delete empty columns.
- **Task Modals & Drawers**: Task prioritization (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), status tags, due dates, assignees, and descriptions.
- **Audit Activity Trail**: Real-time activity drawer displaying every card movement, board creation, and edit.

### ⚡ Real-Time Collaboration & Multi-Level Presence
- **Socket.IO Engine**: WebSocket transport with automated HTTP long-polling fallback.
- **Dual-Level Presence**:
  - **Workspace (Tenant) Presence**: Displays all active colleagues online in the current workspace in the global dashboard header.
  - **Board-Level Presence**: Displays active collaborator avatars in the board toolbar.
- **Deduplicated Multi-Tab Tracking**: Opening multiple tabs or reconnections automatically deduplicates user presence.
- **Zero-Latency Invalidation**: Smart cache synchronization with TanStack Query automatically refreshes board state without full-page reloads.

### ↩️ Safe Undo & Redo Engine
- **Task Movement Undo/Redo**: Revert accidental drag-and-drops with instant inverse column transfers.
- **Task Edit Undo/Redo**: Restore previous field values (title, description, priority, tags, assignees).
- **Optimistic Concurrency Control (OCC) Protection**: Every undo/redo operation sends the latest task version to the backend. If another collaborator concurrently modified the task, the server rejects the undo with `409 Conflict`, preventing overwriting newer collaborative changes.
- **Tenant Authorization**: All undo/redo actions execute through validated backend endpoints with RBAC checks.
- **Keyboard Shortcuts**: Standard `Ctrl+Z` (Undo) and `Ctrl+Y` or `Ctrl+Shift+Z` (Redo) with action count tooltips.

### 🔒 Enterprise Security & Concurrency
- **Cryptographic JWT Authentication**: Verified on both HTTP API requests and WebSocket handshakes.
- **Optimistic Concurrency Control (OCC)**: Prevents accidental overwrites using monotonic version tracking. Concurrent stale updates are rejected with `HTTP 409 Conflict`.
- **Infrastructure Hardening**: Integrated **Helmet** security headers, brute-force rate limiters (`express-rate-limit`), and parameterization via Prisma ORM.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend UI** | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Lucide Icons |
| **State & Cache** | TanStack Query v5, React Context API, Axios Interceptors |
| **Interactions** | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` |
| **Backend API** | Node.js, Express, TypeScript, Zod, Morgan, Helmet, express-rate-limit |
| **Real-Time** | Socket.IO (v4 Server & Client), In-Memory Presence Manager |
| **Database & ORM** | Supabase PostgreSQL, Prisma ORM v5 (9 Models, Relations, & Indexes) |
| **Security & Auth** | JWT (`jsonwebtoken`), bcrypt password hashing (12 rounds) |
| **Testing** | Vitest (22 Unit & Integration Tests), Supertest |

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────┐
│             Frontend Application (Vite + React)        │
│    • TanStack Query Cache     • @dnd-kit Drag Engine   │
│    • Live Presence Pills      • ErrorBoundary & Auth   │
└───────────────────┬────────────────────┬───────────────┘
                    │ REST API           │ WebSockets (Socket.IO)
                    ▼                    ▼
┌────────────────────────────────────────────────────────┐
│             Backend API Gateway (Express + Node.js)    │
│    • Helmet Headers           • JWT Handshake Auth     │
│    • Rate Limiters            • Server-Verified Rooms  │
│    • Central Error Handler    • In-Memory Presence     │
└───────────────────┬────────────────────┬───────────────┘
                    │                    │
                    │ Post-Commit Broadcasts
                    ▼                    ▼
┌────────────────────────────────────────────────────────┐
│                 Data Persistence Layer                 │
│    • Prisma ORM (Version Locks & Parameterized SQL)    │
│    • Hosted Supabase PostgreSQL Database (9 Tables)    │
└────────────────────────────────────────────────────────┘
```

---

## 🖼️ Visual Preview & UI Highlights

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🗂️ KanbanFlow  [ Acme Corp ▾ ] [ Engineering ▾ ]            (● Live Sync)   │
│                                                   [👤 Sarah] [👤 Bob] (+1)   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 📋 Sprint 34 Board   v4                      [ 🔄 Sync ]  [ ➕ Add Column ]  │
│                                                                             │
│  [ To Do (2) ]          [ In Progress (1) ]        [ Done (3) ]             │
│ ┌─────────────────────┐ ┌─────────────────────┐   ┌─────────────────────┐   │
│ │ 🔴 Design Schema    │ │ 🟡 Real-Time Sockets│   │ 🟢 Auth Middleware  │   │
│ │ Due Tomorrow • v2   │ │ Live presence • v3  │   │ Tested • v1         │   │
│ └─────────────────────┘ └─────────────────────┘   └─────────────────────┘   │
│ ┌─────────────────────┐                                                     │
│ │ 🔵 Setup Vercel     │                                                     │
│ └─────────────────────┘                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Multi-Tenant Data Hierarchy

Every business entity strictly belongs to an authorized organization and tenant:

```
Organization (e.g. Acme Corporation)
  ├── Membership (User A -> ORG_ADMIN)
  ├── Tenant / Workspace 1 (e.g. Engineering)
  │     ├── Membership (User B -> MEMBER)
  │     ├── Board 1 ("Sprint 34 Board")
  │     │     ├── Column 1 ("To Do")
  │     │     │     └── Task ("Design Schema", version: 1)
  │     │     └── Column 2 ("In Progress")
  │     └── Activity Logs (Live audit trail)
  └── Tenant / Workspace 2 (e.g. Marketing)
        └── Board 2 ("Q4 Product Launch")
```

---

## ⚡ Real-Time Collaboration Engine

KanbanFlow creates dedicated server-verified rooms:
- **`board:{boardId}`**: Broadcasts task movements, column additions, edits, and deletions.
- **`tenant:{tenantId}`**: Broadcasts workspace activity events (`activity:created`) and new board creations.

### Supported Real-Time Events
| Event | Destination | Payload Summary |
|---|---|---|
| `presence:update` | `board:{boardId}` | Current online viewers with names & avatars |
| `task:created` | `board:{boardId}` | New task card added to column |
| `task:moved` | `board:{boardId}` | Task moved between columns or reordered |
| `task:updated` | `board:{boardId}` | Title, tags, description, or priority edited |
| `task:deleted` | `board:{boardId}` | Task deleted |
| `column:created` | `board:{boardId}` | New column added |
| `column:reordered`| `board:{boardId}` | Columns reordered via drag-and-drop |
| `column:deleted` | `board:{boardId}` | Column removed |
| `activity:created`| `tenant:{tenantId}` | Audit log stream update |

For deep-dive technical details, see [docs/realtime-architecture.md](docs/realtime-architecture.md).

---

## 🛡️ Security & Concurrency Controls

1. **Optimistic Concurrency Control (OCC)**: Every task mutation includes its known version. If another teammate moves the task first, the database atomically rejects the conflict (`HTTP 409`), preventing silent overwrites.
2. **Server-Side Room Authorization**: Client socket join events (`join:board`, `join:tenant`) verify database membership before granting room entry.
3. **Helmet HTTP Protection**: Enforces `nosniff`, `SAMEORIGIN`, and HSTS security policies.
4. **Brute-Force Rate Limiting**: Auth endpoints limit failed login attempts to 30 per 15 minutes.
5. **SQL Injection Immune**: 100% parameterized queries via Prisma ORM.

For complete audit records, see [docs/security.md](docs/security.md).

---

## 💻 Prerequisites & Installation

### Prerequisites
- **Node.js**: v20 or higher (`node -v`)
- **npm**: v10 or higher (`npm -v`)
- **Database**: Active Supabase PostgreSQL database

### 1. Clone & Setup Project
```bash
# Navigate to the workspace
cd collaborative-kanban

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure Environment Variables
Copy the provided `.env.example` templates:

```bash
# Backend setup
cd ../backend
cp .env.example .env

# Frontend setup
cd ../frontend
cp .env.example .env
```

Edit `backend/.env` with your Supabase PostgreSQL credentials and a secure `JWT_SECRET`.

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)
```env
PORT=4000
NODE_ENV="development"
DATABASE_URL="postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[PASS]@db.[REF].supabase.co:5432/postgres"
JWT_SECRET="your-super-secret-jwt-key-min-64-characters"
JWT_EXPIRES_IN="7d"
FRONTEND_URL="http://localhost:5173"
BCRYPT_SALT_ROUNDS=12
```

### Frontend (`frontend/.env`)
```env
VITE_API_URL="http://localhost:4000"
VITE_WS_URL="http://localhost:4000"
```

---

## 🚀 Development Commands

```bash
# Start Backend API & WebSocket Server (Port 4000)
cd backend
npm run dev

# Start Frontend Vite Application (Port 5173)
cd frontend
npm run dev
```

Visit `http://localhost:5173` in your browser!

---

## 🧪 Automated Testing Suite

The backend includes 22 automated integration and unit tests covering authentication, RBAC authorization, concurrency race conditions, and Socket.IO real-time room isolation.

```bash
cd backend
npm run test
```

### Test Results Summary:
```
 ✓ src/tests/validation_concurrency.test.ts (7 tests)
 ✓ src/tests/auth_security.test.ts (6 tests)
 ✓ src/tests/socket_realtime.test.ts (9 tests)

 Test Files  3 passed (3)
      Tests  22 passed (22)
   Duration  4.57s
```

---

## 🌐 Deployment Guide

| Component | Target Platform | Build Command | Output |
|---|---|---|---|
| **Database** | Supabase PostgreSQL | `npx prisma db push` | Hosted PostgreSQL |
| **Backend API** | Render / Railway | `npm install && npx prisma generate && npm run build` | `dist/index.js` |
| **Frontend** | Vercel | `npm run build` | `dist/` |

- A multi-stage [Dockerfile](backend/Dockerfile) is included for container deployments.
- [vercel.json](frontend/vercel.json) is preconfigured for single-page application client routing.
- For complete step-by-step instructions, see [docs/deployment.md](docs/deployment.md).

---

## 📚 Documentation Index

- [Visual Database ER Diagram](docs/er-diagram.md) *(Complete Mermaid diagram with PKs, FKs & Cardinality)*
- [Assignment Compliance Matrix](docs/assignment-compliance.md) *(100% Audit of all internship requirements)*
- [Architecture & Multi-Tenancy Design](docs/architecture.md)
- [REST API & WebSocket Specifications](docs/api.md)
- [Real-Time Collaboration Engine](docs/realtime-architecture.md)
- [Security Audit & Hardening Report](docs/security.md)
- [Production Deployment Guide](docs/deployment.md)

---

## 🎓 Internship Evaluator Submission Notes

- **Zero Mock Data**: All operations read and write to live Supabase PostgreSQL tables.
- **Production Chunking**: Frontend routes utilize `React.lazy()` code splitting, keeping all bundle chunks under 225 kB.
- **Testing Real-Time**: Open `http://localhost:5173/dashboard/boards/<id>` in two separate browser windows (or an Incognito window) to test live task synchronization and active collaborator presence pills.
