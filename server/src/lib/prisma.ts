// Nothing imports this yet - @prisma/client has no generated models until
// schema.sql is applied to a real database and `npm run prisma:pull` +
// `npm run prisma:generate` are run against it (see prisma/schema.prisma).
// Once that's done, this becomes:
//
//   import { PrismaClient } from '@prisma/client';
//   export const prisma = new PrismaClient();
export {};
