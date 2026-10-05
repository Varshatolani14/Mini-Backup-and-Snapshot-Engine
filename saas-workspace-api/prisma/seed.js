'use strict';

/**
 * prisma/seed.js
 *
 * Seeds the database with demo data for local development.
 * Run with: npm run db:seed
 *
 * Creates:
 *   - 3 users (owner, admin, member)
 *   - 1 organization
 *   - 2 projects
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data (dev only)
  await prisma.project.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  const hash = (p) => bcrypt.hash(p, 10);

  // ── Users ─────────────────────────────────────────────────
  const [owner, admin, member] = await Promise.all([
    prisma.user.create({
      data: {
        firstName: 'Alice',
        lastName: 'Owner',
        email: 'alice@example.com',
        passwordHash: await hash('Password1'),
      },
    }),
    prisma.user.create({
      data: {
        firstName: 'Bob',
        lastName: 'Admin',
        email: 'bob@example.com',
        passwordHash: await hash('Password1'),
      },
    }),
    prisma.user.create({
      data: {
        firstName: 'Carol',
        lastName: 'Member',
        email: 'carol@example.com',
        passwordHash: await hash('Password1'),
      },
    }),
  ]);

  // ── Organization ──────────────────────────────────────────
  const org = await prisma.organization.create({
    data: {
      name: 'Acme Corp',
      slug: 'acme-corp-demo',
      description: 'Demo organization for seeded data',
      ownerId: owner.id,
    },
  });

  // ── Memberships ───────────────────────────────────────────
  await prisma.organizationMember.createMany({
    data: [
      { organizationId: org.id, userId: owner.id, role: 'OWNER' },
      { organizationId: org.id, userId: admin.id, role: 'ADMIN' },
      { organizationId: org.id, userId: member.id, role: 'MEMBER' },
    ],
  });

  // ── Projects ──────────────────────────────────────────────
  await prisma.project.createMany({
    data: [
      {
        name: 'Website Redesign',
        description: 'Redesign the public marketing website',
        organizationId: org.id,
        createdByUserId: owner.id,
        status: 'ACTIVE',
      },
      {
        name: 'Mobile App v2',
        description: 'Second version of the iOS/Android app',
        organizationId: org.id,
        createdByUserId: admin.id,
        status: 'ACTIVE',
      },
    ],
  });

  console.log('✅ Seed complete');
  console.log('\nDemo credentials (password for all: Password1):');
  console.log(`  OWNER  → alice@example.com`);
  console.log(`  ADMIN  → bob@example.com`);
  console.log(`  MEMBER → carol@example.com`);
  console.log(`\n  Org ID: ${org.id}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
