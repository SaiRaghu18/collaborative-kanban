import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../index';

describe('1. Public Endpoints & Token Rejection', () => {
  it('should allow public access to /api/health and report database health & security headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
    expect(res.body.data.database).toBe('healthy');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('should reject unauthenticated request to /api/organizations with 401', async () => {
    const res = await request(app).get('/api/organizations');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should reject request with an invalid/forged JWT signature with 401', async () => {
    const res = await request(app)
      .get('/api/organizations')
      .set('Authorization', 'Bearer invalid-token-signature-12345');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should reject unauthenticated request to /api/tenants with 401', async () => {
    const res = await request(app).get('/api/tenants/00000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should reject unauthenticated request to /api/boards with 401', async () => {
    const res = await request(app).get('/api/boards/00000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('should reject unauthenticated request to /api/tasks with 401', async () => {
    const res = await request(app).get('/api/tasks/00000000-0000-0000-0000-000000000001');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
