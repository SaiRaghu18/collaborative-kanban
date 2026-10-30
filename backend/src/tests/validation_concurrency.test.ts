import { describe, it, expect } from 'vitest';
import {
  createOrganizationSchema,
  createTenantSchema,
  reorderColumnsSchema,
  updateTaskSchema,
  moveTaskSchema,
} from '../validators/kanban.validator';

describe('2. Zod Schema Validation & Concurrency Rules', () => {
  it('should reject organization with invalid slug (uppercase or spaces)', () => {
    const result = createOrganizationSchema.safeParse({
      name: 'Test Org',
      slug: 'INVALID SLUG',
    });
    expect(result.success).toBe(false);
  });

  it('should accept organization with valid lowercase slug', () => {
    const result = createOrganizationSchema.safeParse({
      name: 'Valid Org',
      slug: 'valid-org-123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject duplicate column IDs in reorder request', () => {
    const dupId = '11111111-1111-1111-1111-111111111111';
    const result = reorderColumnsSchema.safeParse({
      columnIds: [dupId, dupId],
    });
    expect(result.success).toBe(false);
  });

  it('should accept unique column IDs in reorder request', () => {
    const col1 = '11111111-1111-1111-1111-111111111111';
    const col2 = '22222222-2222-2222-2222-222222222222';
    const result = reorderColumnsSchema.safeParse({
      columnIds: [col1, col2],
    });
    expect(result.success).toBe(true);
  });

  it('should reject task updates that omit the version integer', () => {
    const result = updateTaskSchema.safeParse({
      title: 'Updated title without version',
    });
    expect(result.success).toBe(false);
  });

  it('should accept task updates that include a valid non-negative version', () => {
    const result = updateTaskSchema.safeParse({
      title: 'Updated title',
      version: 2,
    });
    expect(result.success).toBe(true);
  });

  it('should reject task moves without version', () => {
    const targetCol = '11111111-1111-1111-1111-111111111111';
    const result = moveTaskSchema.safeParse({
      targetColumnId: targetCol,
    });
    expect(result.success).toBe(false);
  });
});
