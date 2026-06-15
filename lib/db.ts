import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

function makeClient() {
  const url       = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) throw new Error('TURSO_DATABASE_URL is not set');

  const adapter = new PrismaLibSql({ url, authToken });
  return new PrismaClient({ adapter });
}

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
