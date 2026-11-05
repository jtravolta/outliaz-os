import assert from "node:assert/strict";
import test from "node:test";

import postgres from "postgres";

type SchemaSnapshot = {
  tables: string[];
  enums: { name: string; label: string; position: number }[];
  constraints: { table: string; name: string; definition: string }[];
  indexes: { table: string; name: string; definition: string }[];
};

async function snapshot(connectionString: string): Promise<SchemaSnapshot> {
  const sql = postgres(connectionString, { max: 1, prepare: false });
  try {
    const tables = await sql<{ name: string }[]>`
      select table_name as name
      from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
        and table_name <> '_prisma_migrations'
      order by table_name
    `;
    const enums = await sql<SchemaSnapshot["enums"]>`
      select t.typname as name, e.enumlabel as label, e.enumsortorder::int as position
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public'
      order by t.typname, e.enumsortorder
    `;
    const constraints = await sql<SchemaSnapshot["constraints"]>`
      select c.relname as table, con.conname as name,
             pg_get_constraintdef(con.oid, true) as definition
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname <> '_prisma_migrations'
      order by c.relname, con.conname
    `;
    const indexes = await sql<SchemaSnapshot["indexes"]>`
      select tablename as table, indexname as name, indexdef as definition
      from pg_indexes
      where schemaname = 'public' and tablename <> '_prisma_migrations'
      order by tablename, indexname
    `;
    const stableConstraints = constraints.filter(
      ({ name }) => !name.endsWith("_not_null"),
    );
    const stableIndexes = indexes
      .map(({ table, definition }) => ({
        table,
        name: "",
        definition: definition.replace(
          /^CREATE (UNIQUE )?INDEX \S+ ON /,
          "CREATE $1INDEX ON ",
        ),
      }))
      .sort((a, b) =>
        `${a.table}:${a.definition}`.localeCompare(
          `${b.table}:${b.definition}`,
        ),
      );
    return {
      tables: tables.map(({ name }) => name),
      enums,
      constraints: stableConstraints,
      indexes: stableIndexes,
    };
  } finally {
    await sql.end();
  }
}

test("Prisma baseline recreates the existing PostgreSQL schema", async () => {
  const sourceUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  assert.ok(sourceUrl, "DIRECT_URL or DATABASE_URL must be configured");

  const testUrl =
    process.env.TEST_DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:5432/outbound_os_supabase_test";

  const [source, target] = await Promise.all([
    snapshot(sourceUrl),
    snapshot(testUrl),
  ]);

  assert.deepEqual(target, source);
});
