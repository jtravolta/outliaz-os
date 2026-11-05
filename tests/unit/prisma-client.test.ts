import assert from "node:assert/strict";
import test from "node:test";

import { getPrismaClient } from "../../lib/db/prisma";

test("getPrismaClient reuses one cached client", () => {
  const holder = globalThis as unknown as {
    __prisma?: ReturnType<typeof getPrismaClient>;
  };
  const previousClient = holder.__prisma;

  delete holder.__prisma;
  try {
    const first = getPrismaClient();
    const second = getPrismaClient();

    assert.equal(first, second);
    assert.equal(holder.__prisma, first);
  } finally {
    holder.__prisma = previousClient;
  }
});
