import { PrismaClient } from '@prisma/client';

// Singleton - avoids exhausting MySQL connections under tsx's hot-reload in dev.
export const prisma = new PrismaClient();
