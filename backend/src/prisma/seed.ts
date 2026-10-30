/**
 * Seed script — creates sample data for development.
 * Run with: npm run db:seed
 *
 * Creates:
 *  - 3 users (admin, manager, member)
 *  - 1 organization (Acme Corp)
 *  - 2 tenants (Engineering, Marketing)
 *  - Appropriate memberships
 */

import { PrismaClient, MembershipRole, MembershipScope } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // ─── Clean existing data ───────────────────────────────────────────────────
  await prisma.activityLog.deleteMany();
  await prisma.task.deleteMany();
  await prisma.column.deleteMany();
  await prisma.board.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  console.log('🗑  Cleared existing data');

  // ─── Create users ──────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Password123!', 12);

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@acme.com',
      firstName: 'Alice',
      lastName: 'Admin',
      passwordHash,
    },
  });

  const managerUser = await prisma.user.create({
    data: {
      email: 'manager@acme.com',
      firstName: 'Bob',
      lastName: 'Manager',
      passwordHash,
    },
  });

  const memberUser = await prisma.user.create({
    data: {
      email: 'member@acme.com',
      firstName: 'Carol',
      lastName: 'Member',
      passwordHash,
    },
  });

  console.log('👤 Created users:', adminUser.email, managerUser.email, memberUser.email);

  // ─── Create organization ───────────────────────────────────────────────────
  const organization = await prisma.organization.create({
    data: {
      name: 'Acme Corporation',
      slug: 'acme-corp',
      description: 'A sample organization for development',
    },
  });

  console.log('🏢 Created organization:', organization.name);

  // ─── Create tenants ────────────────────────────────────────────────────────
  const engineeringTenant = await prisma.tenant.create({
    data: {
      name: 'Engineering',
      slug: 'engineering',
      description: 'Software engineering team',
      organizationId: organization.id,
    },
  });

  const marketingTenant = await prisma.tenant.create({
    data: {
      name: 'Marketing',
      slug: 'marketing',
      description: 'Marketing and growth team',
      organizationId: organization.id,
    },
  });

  console.log('🏠 Created tenants:', engineeringTenant.name, marketingTenant.name);

  // ─── Create memberships ────────────────────────────────────────────────────

  // Admin is ORG_ADMIN
  await prisma.membership.create({
    data: {
      userId: adminUser.id,
      organizationId: organization.id,
      role: MembershipRole.ORG_ADMIN,
      scope: MembershipScope.ORGANIZATION,
    },
  });

  // Manager is MEMBER at org level
  await prisma.membership.create({
    data: {
      userId: managerUser.id,
      organizationId: organization.id,
      role: MembershipRole.MEMBER,
      scope: MembershipScope.ORGANIZATION,
    },
  });

  // Member is MEMBER at org level
  await prisma.membership.create({
    data: {
      userId: memberUser.id,
      organizationId: organization.id,
      role: MembershipRole.MEMBER,
      scope: MembershipScope.ORGANIZATION,
    },
  });

  // Manager is TENANT_ADMIN in Engineering
  await prisma.membership.create({
    data: {
      userId: managerUser.id,
      organizationId: organization.id,
      tenantId: engineeringTenant.id,
      role: MembershipRole.TENANT_ADMIN,
      scope: MembershipScope.TENANT,
    },
  });

  // Carol is MEMBER in Engineering
  await prisma.membership.create({
    data: {
      userId: memberUser.id,
      organizationId: organization.id,
      tenantId: engineeringTenant.id,
      role: MembershipRole.MEMBER,
      scope: MembershipScope.TENANT,
    },
  });

  // Manager is MEMBER in Marketing
  await prisma.membership.create({
    data: {
      userId: managerUser.id,
      organizationId: organization.id,
      tenantId: marketingTenant.id,
      role: MembershipRole.MEMBER,
      scope: MembershipScope.TENANT,
    },
  });

  console.log('🔑 Created memberships');

  // ─── Create a sample board ─────────────────────────────────────────────────
  const board = await prisma.board.create({
    data: {
      name: 'Sprint 1',
      description: 'Our first sprint board',
      tenantId: engineeringTenant.id,
      createdById: adminUser.id,
    },
  });

  // Create default columns
  const columns = await Promise.all([
    prisma.column.create({
      data: { title: 'Backlog', boardId: board.id, sortOrder: 1000 },
    }),
    prisma.column.create({
      data: { title: 'In Progress', boardId: board.id, sortOrder: 2000 },
    }),
    prisma.column.create({
      data: { title: 'Review', boardId: board.id, sortOrder: 3000 },
    }),
    prisma.column.create({
      data: { title: 'Done', boardId: board.id, sortOrder: 4000 },
    }),
  ]);

  // Create sample tasks
  await prisma.task.create({
    data: {
      title: 'Set up project repository',
      description: 'Initialize the monorepo with frontend and backend',
      columnId: columns[3].id, // Done
      tenantId: engineeringTenant.id,
      createdById: adminUser.id,
      assigneeId: adminUser.id,
      priority: 'HIGH',
      status: 'DONE',
      sortOrder: 1000,
    },
  });

  await prisma.task.create({
    data: {
      title: 'Implement authentication',
      description: 'JWT-based auth with bcrypt password hashing',
      columnId: columns[1].id, // In Progress
      tenantId: engineeringTenant.id,
      createdById: adminUser.id,
      assigneeId: managerUser.id,
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      sortOrder: 1000,
    },
  });

  await prisma.task.create({
    data: {
      title: 'Design database schema',
      description: 'Prisma schema with all models and relations',
      columnId: columns[2].id, // Review
      tenantId: engineeringTenant.id,
      createdById: managerUser.id,
      assigneeId: managerUser.id,
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      sortOrder: 1000,
    },
  });

  await prisma.task.create({
    data: {
      title: 'Build Kanban drag-and-drop UI',
      description: 'Use dnd-kit for smooth card reordering',
      columnId: columns[0].id, // Backlog
      tenantId: engineeringTenant.id,
      createdById: managerUser.id,
      assigneeId: memberUser.id,
      priority: 'MEDIUM',
      status: 'TODO',
      sortOrder: 1000,
    },
  });

  console.log('📋 Created sample board with columns and tasks');

  console.log(`
✅ Seed complete!

─────────────────────────────────────────────────
Test Accounts (all use password: Password123!)
─────────────────────────────────────────────────
  Admin:   admin@acme.com   (ORG_ADMIN)
  Manager: manager@acme.com (TENANT_ADMIN in Engineering)
  Member:  member@acme.com  (MEMBER in Engineering)
─────────────────────────────────────────────────
  `);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
