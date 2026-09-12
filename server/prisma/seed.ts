import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';

/**
 * Creates a single admin account for initial access. Run with `npm run db:seed`.
 * Safe to re-run - does nothing if the account already exists.
 */
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@aak.local';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';

  const existing = await prisma.users.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user ${email} already exists - skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.users.create({
    data: {
      email,
      password_hash: passwordHash,
      role: 'admin',
      status: 'active',
    },
  });

  console.log(`Created admin user ${email} (password: ${password} - change it after first login).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
