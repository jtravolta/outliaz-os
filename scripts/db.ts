/**
 * Local Postgres for development. Runs a real PostgreSQL 18 server out of
 * ./node_modules (no Docker, no system install) on 127.0.0.1:5432 and stays
 * alive until killed.
 *
 *   npm run db
 */
import { existsSync } from "node:fs";
import EmbeddedPostgres from "embedded-postgres";

const dir = ".pgdata";
const port = Number(process.env.PGPORT ?? 5432);

const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: "postgres",
  password: "postgres",
  port,
  persistent: true,
});

if (!existsSync(`${dir}/PG_VERSION`)) {
  console.log("initialising cluster…");
  await pg.initialise();
}

await pg.start();
console.log(`postgres ready on 127.0.0.1:${port}`);

try {
  const client = pg.getPgClient("postgres");
  await client.connect();
  const { rows } = await client.query("select 1 from pg_database where datname = 'outbound_os'");
  if (!rows.length) {
    await client.query('create database outbound_os');
    console.log("created database outbound_os");
  }
  await client.end();
} catch (err) {
  console.error("database bootstrap failed:", err);
}

const shutdown = async () => {
  console.log("\nstopping postgres…");
  await pg.stop().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

setInterval(() => {}, 1 << 30);
