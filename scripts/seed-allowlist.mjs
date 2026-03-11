import { createClient } from "@libsql/client";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const seededEntries = [
  {
    email: "kts123@estsoft.com",
    name: "ESTsoft Reviewer",
    role: "manager",
  },
  {
    email: "gyuwon05@gmail.com",
    name: "Gyuwon",
    role: "manager",
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

await db.execute("DROP TABLE IF EXISTS allowlist_users");
await db.execute("DROP TABLE IF EXISTS access_requests");
await db.execute("DROP TABLE IF EXISTS daily_generation_usage");

await db.execute(`
  CREATE TABLE allowlist_users (
    email TEXT PRIMARY KEY COLLATE NOCASE,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

await db.execute(`
  CREATE TABLE access_requests (
    email TEXT PRIMARY KEY COLLATE NOCASE,
    name TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

await db.execute(`
  CREATE TABLE daily_generation_usage (
    email TEXT NOT NULL COLLATE NOCASE,
    usage_date TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (email, usage_date)
  );
`);

for (const entry of seededEntries) {
  await db.execute({
    sql: `
      INSERT INTO allowlist_users (email, name, role, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `,
    args: [entry.email, entry.name, entry.role],
  });
}

console.log(
  `허용 계정 시드가 완료되었습니다. ${seededEntries.map((entry) => `${entry.email}(${entry.role})`).join(", ")}`,
);
