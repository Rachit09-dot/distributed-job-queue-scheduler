import {
  PrismaClient,
  Role,
  JobType,
  JobPriority,
  JobStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // ── Users (idempotent via upsert) ─────────────────────────────────────────

  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@jobqueue.dev' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@jobqueue.dev',
      passwordHash: adminPassword,
      role: Role.ADMIN,
    },
  });

  const userPassword = await bcrypt.hash('user1234', 12);
  const user = await prisma.user.upsert({
    where: { email: 'demo@jobqueue.dev' },
    update: {},
    create: {
      name: 'Demo User',
      email: 'demo@jobqueue.dev',
      passwordHash: userPassword,
      role: Role.USER,
    },
  });

  // ── Sample jobs (idempotent via idempotencyKey) ───────────────────────────
  // Each sample job has a stable idempotencyKey so running the seed multiple
  // times does NOT create duplicate jobs — the existing job is returned instead.

  const sampleJobs: {
    type: JobType;
    payload: object;
    priority: JobPriority;
    idempotencyKey: string;
  }[] = [
    {
      type: JobType.EMAIL_SIMULATION,
      payload: { to: 'recipient@example.com', subject: 'Welcome!', body: 'Hello World' },
      priority: JobPriority.HIGH,
      idempotencyKey: 'seed-email-simulation-v1',
    },
    {
      type: JobType.REPORT_GENERATION,
      payload: { reportType: 'monthly', month: 9, year: 2026 },
      priority: JobPriority.NORMAL,
      idempotencyKey: 'seed-report-generation-v1',
    },
    {
      type: JobType.DATA_PROCESSING,
      payload: { numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      priority: JobPriority.LOW,
      idempotencyKey: 'seed-data-processing-v1',
    },
    {
      type: JobType.CUSTOM_DELAY,
      payload: { delaySeconds: 2 },
      priority: JobPriority.CRITICAL,
      idempotencyKey: 'seed-custom-delay-v1',
    },
  ];

  let created = 0;
  let skipped = 0;

  for (const jobDef of sampleJobs) {
    const existing = await prisma.job.findFirst({
      where: {
        userId: user.id,
        idempotencyKey: jobDef.idempotencyKey,
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.job.create({
      data: {
        userId: user.id,
        type: jobDef.type,
        payload: jobDef.payload,
        priority: jobDef.priority,
        status: JobStatus.CREATED,
        maxAttempts: 3,
        idempotencyKey: jobDef.idempotencyKey,
      },
    });
    created++;
  }

  console.log('✅ Seed complete');
  console.log(`   Admin: admin@jobqueue.dev / admin123`);
  console.log(`   User:  demo@jobqueue.dev / user1234`);
  console.log(`   Sample jobs: ${created} created, ${skipped} already existed`);

  // Suppress unused variable warning
  void admin;
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
