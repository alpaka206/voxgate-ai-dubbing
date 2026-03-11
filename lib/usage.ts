import { getDb } from "@/lib/db";
import { servicePolicy } from "@/lib/allowlist";

const usageTableSql = `
  CREATE TABLE IF NOT EXISTS daily_generation_usage (
    email TEXT NOT NULL COLLATE NOCASE,
    usage_date TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (email, usage_date)
  );
`;

let usageReadyPromise: Promise<void> | null = null;

export type DailyUsageSummary = {
  limit: number;
  remaining: number;
  usageDate: string;
  used: number;
};

function getTodayInSeoul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function ensureUsageTable() {
  if (!usageReadyPromise) {
    usageReadyPromise = getDb().execute(usageTableSql).then(() => undefined);
  }

  return usageReadyPromise;
}

export function getDailyGenerationLimit() {
  return servicePolicy.dailyGenerationLimit;
}

export async function getDailyUsageSummary(email: string) {
  await ensureUsageTable();

  const usageDate = getTodayInSeoul();
  const result = await getDb().execute({
    sql: `
      SELECT count
      FROM daily_generation_usage
      WHERE email = ? AND usage_date = ?
      LIMIT 1
    `,
    args: [email, usageDate],
  });

  const used = Number(result.rows[0]?.count ?? 0);
  const limit = getDailyGenerationLimit();

  return {
    limit,
    remaining: Math.max(limit - used, 0),
    usageDate,
    used,
  } satisfies DailyUsageSummary;
}

export async function incrementDailyUsage(email: string) {
  await ensureUsageTable();

  const usageDate = getTodayInSeoul();

  await getDb().execute({
    sql: `
      INSERT INTO daily_generation_usage (email, usage_date, count, created_at, updated_at)
      VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(email, usage_date) DO UPDATE SET
        count = daily_generation_usage.count + 1,
        updated_at = CURRENT_TIMESTAMP
    `,
    args: [email, usageDate],
  });
}
