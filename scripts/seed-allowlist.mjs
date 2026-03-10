import { createClient } from "@libsql/client";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const seededEntries = [
  {
    email: "kts123@estsoft.com",
    name: "ESTsoft Reviewer",
    role: "pro",
    status: "approved",
  },
  {
    email: "gyuwon05@gmail.com",
    name: "Gyuwon",
    role: "plus",
    status: "approved",
  },
];

loadEnvConfig(process.cwd());

const databaseUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!databaseUrl) {
  throw new Error("환경 변수가 설정되지 않았습니다. TURSO_DATABASE_URL");
}

if (!authToken) {
  throw new Error("환경 변수가 설정되지 않았습니다. TURSO_AUTH_TOKEN");
}

const db = createClient({
  url: databaseUrl,
  authToken,
});

await db.execute(`
  CREATE TABLE IF NOT EXISTS allowlist_users (
    email TEXT PRIMARY KEY COLLATE NOCASE,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'basic',
    status TEXT NOT NULL DEFAULT 'approved',
    requested_plan TEXT,
    requested_at TEXT,
    approved_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const schema = await db.execute("PRAGMA table_info(allowlist_users)");
const columns = new Set(schema.rows.map((row) => String(row.name)));

const migrations = [
  ["name", "ALTER TABLE allowlist_users ADD COLUMN name TEXT"],
  ["role", "ALTER TABLE allowlist_users ADD COLUMN role TEXT NOT NULL DEFAULT 'basic'"],
  ["status", "ALTER TABLE allowlist_users ADD COLUMN status TEXT NOT NULL DEFAULT 'approved'"],
  ["requested_plan", "ALTER TABLE allowlist_users ADD COLUMN requested_plan TEXT"],
  ["requested_at", "ALTER TABLE allowlist_users ADD COLUMN requested_at TEXT"],
  ["approved_at", "ALTER TABLE allowlist_users ADD COLUMN approved_at TEXT"],
  ["updated_at", "ALTER TABLE allowlist_users ADD COLUMN updated_at TEXT"],
];

for (const [column, sql] of migrations) {
  if (!columns.has(column)) {
    await db.execute(sql);
  }
}

for (const entry of seededEntries) {
  await db.execute({
    sql: `
      INSERT INTO allowlist_users (
        email,
        name,
        role,
        status,
        requested_plan,
        requested_at,
        approved_at,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(email) DO UPDATE SET
        name = excluded.name,
        role = excluded.role,
        status = excluded.status,
        requested_plan = NULL,
        approved_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `,
    args: [entry.email, entry.name, entry.role, entry.status],
  });
}

console.log(
  `허용 계정 시드가 완료되었습니다. ${seededEntries.map((entry) => `${entry.email}(${entry.role})`).join(", ")}`,
);
