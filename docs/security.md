# KanbanFlow Security Architecture & Audit Report

This document outlines the security architecture, threat model mitigations, and compliance standards implemented across **KanbanFlow**.

---

## 1. Authentication & Session Management

### JWT Cryptographic Verification
- **Stateless Tokens**: Authentication relies on HMAC-SHA256 signed JSON Web Tokens (JWT).
- **Handshake Verification**: Sockets verify token signatures during the initial handshake before establishing WebSocket upgrades.
- **Strict Expiry**: Tokens are validated against expiry timestamps (`exp`), rejecting expired credentials.
- **Database Revocation/Deactivation Check**: Socket authentication queries the database to confirm that the user exists and is active (`isActive: true`). Deactivated users are blocked immediately.
- **Header Injection**: Frontend Axios interceptors automatically inject `Authorization: Bearer <token>` on all REST API requests.

### Password Hashing
- Passwords are encrypted using **bcrypt** with **12 salt rounds**.
- Plaintext passwords are never stored, logged, or returned in database queries.
- Password hashes are strictly omitted from all API responses via explicit Prisma `select` clauses.

---

## 2. Multi-Tenant Authorization & Data Isolation

### Multi-Tenant Hierarchy
1. **Organization**: The top-level corporate account entity.
2. **Tenant (Workspace)**: A departmental or project workspace within an organization (e.g. "Engineering", "Marketing").
3. **Board**: Kanban boards belonging strictly to a single tenant.
4. **Column & Task**: Belong to a board, with tasks explicitly denormalized with `tenantId` to enforce isolation.

### Server-Enforced Boundaries
- **Never Trust Client Input**: Client-supplied `organizationId`, `tenantId`, or `boardId` are never trusted without server-side verification.
- **Database Relationship Checks**:
  ```ts
  // Membership check verifies that the user belongs to the requested tenant or organization
  const membership = await prisma.membership.findFirst({
    where: {
      userId: req.user.id,
      OR: [
        { tenantId: board.tenantId, scope: 'TENANT' },
        { scope: 'ORGANIZATION', role: 'ORG_ADMIN' },
      ],
    },
  });
  if (!membership) throw new ForbiddenError('Access denied to this workspace');
  ```
- **Cross-Tenant Movement Prevention**: Moving tasks between columns validates that both the source column and the destination column belong to the exact same tenant. Cross-tenant movements are blocked with a `400 Validation Error`.

---

## 3. Real-Time WebSocket Room Authorization

- **No Public Broadcasts**: The backend strictly avoids global `io.emit()` for sensitive board and tenant updates.
- **Authorized Room Joins**: Sockets only enter `board:{boardId}` or `tenant:{tenantId}` after server-side database checks confirm tenant membership.
- **Disconnect Cleanup**: Sockets leaving or disconnecting immediately trigger presence removal, preventing stale or phantom active user leaks.

---

## 4. API & Infrastructure Security

### HTTP Security Headers (Helmet)
Express integrates **Helmet** to set industry-standard security headers:
- `X-Content-Type-Options: nosniff`: Prevents MIME-type sniffing.
- `X-Frame-Options: SAMEORIGIN`: Protects against clickjacking.
- `Strict-Transport-Security`: Enforces HTTPS in production.
- `X-XSS-Protection`: Legacy browser cross-site scripting filter.

### Rate Limiting & Brute-Force Defense
- **General API Limiter**: Enforces a limit of 500 requests per 15 minutes per IP (`express-rate-limit`).
- **Authentication Limiter**: Enforces a strict limit of 30 attempts per 15 minutes on `/api/auth/login` and `/api/auth/register` to block credential stuffing and brute-force dictionary attacks.

### SQL Injection Protection
- All database access is mediated by **Prisma ORM**, which uses parameterized queries exclusively.
- Raw SQL statements (such as health check pings) utilize tagged template literals (`prisma.$queryRaw`), ensuring variables are never concatenated directly into SQL strings.

### Input Validation with Zod
- All incoming requests (POST, PUT, PATCH) are validated using strict **Zod** schemas.
- Unrecognized or malicious payload fields are stripped before service logic processes them.

---

## 5. Concurrency & Data Integrity

- **Optimistic Concurrency Control (OCC)**: Every mutable entity (`Board`, `Column`, `Task`) tracks a monotonic integer `version`.
- Updates require the client to supply their held version. If a concurrent collaborator has already mutated the card, the transaction triggers an **HTTP 409 Conflict**, preventing silent data overwrites.

---

## 6. Secret Management & Git Hygiene

- Production credentials (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`) are stored in environment variables, never in source code.
- Comprehensive `.gitignore` patterns prevent committing `.env`, build artifacts (`dist/`), test coverage, and log files.
- Sample configuration templates (`.env.example`) provide safe placeholder values without exposing production keys.
