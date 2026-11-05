import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../generated/prisma/client";

export function createPrismaClient(connectionString: string) {
  const adapter = new PrismaPg({
    connectionString,
    max: Number(process.env.DB_POOL_MAX_PRISMA ?? 5),
  });
  return new PrismaClient({ adapter });
}

// One client per process. Caching on globalThis works in dev (survives hot
// reloads) and in production; creating a client per call opened a fresh TLS
// connection to the remote pooler, adding about a second to every request.
const globalForPrisma = globalThis as unknown as {
  __prisma?: ReturnType<typeof createPrismaClient>;
};

export function getPrismaClient() {
  if (globalForPrisma.__prisma) return globalForPrisma.__prisma;

  const connectionString =
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:5432/outbound_os";

  globalForPrisma.__prisma = createPrismaClient(connectionString);
  return globalForPrisma.__prisma;
}
