import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../generated/prisma/client";

export function createPrismaClient(connectionString: string) {
  const adapter = new PrismaPg({
    connectionString,
    max: Number(process.env.DB_POOL_MAX ?? 1),
  });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  __prisma?: ReturnType<typeof createPrismaClient>;
};

export function getPrismaClient() {
  const connectionString =
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:5432/outbound_os";

  const client =
    globalForPrisma.__prisma ?? createPrismaClient(connectionString);
  if (process.env.NODE_ENV !== "production") globalForPrisma.__prisma = client;
  return client;
}
