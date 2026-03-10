import { getDb } from "@/lib/db";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const accessRoles = ["free", "basic", "plus", "pro"] as const;
export const accessStatuses = ["pending", "approved"] as const;

export type AccessRole = (typeof accessRoles)[number];
export type AccessStatus = (typeof accessStatuses)[number];
export type MembershipStatus = AccessStatus | "not_requested";

export const accessRoleRank: Record<AccessRole, number> = {
  free: 0,
  basic: 1,
  plus: 2,
  pro: 3,
};

export type AllowlistEntry = {
  approvedAt: string | null;
  createdAt: string | null;
  email: string;
  name: string | null;
  requestedAt: string | null;
  requestedPlan: AccessRole | null;
  role: AccessRole;
  status: AccessStatus;
  updatedAt: string | null;
};

export type RoleFeatures = {
  canUseStudio: boolean;
  dailyGenerationLimit: number;
  description: string;
  label: string;
  maxMediaDurationSeconds: number;
};

export const roleFeatures: Record<AccessRole, RoleFeatures> = {
  free: {
    canUseStudio: true,
    dailyGenerationLimit: 3,
    description: "짧은 샘플 파일을 가볍게 더빙해 볼 수 있는 기본 플랜입니다.",
    label: "Free",
    maxMediaDurationSeconds: 30,
  },
  basic: {
    canUseStudio: true,
    dailyGenerationLimit: 10,
    description:
      "조금 더 긴 오디오와 짧은 영상을 자주 더빙할 때 적합한 플랜입니다.",
    label: "Basic",
    maxMediaDurationSeconds: 90,
  },
  plus: {
    canUseStudio: true,
    dailyGenerationLimit: 30,
    description:
      "반복 작업이 많은 팀이나 여러 버전을 테스트할 때 적합한 플랜입니다.",
    label: "Plus",
    maxMediaDurationSeconds: 180,
  },
  pro: {
    canUseStudio: true,
    dailyGenerationLimit: 100,
    description:
      "긴 영상과 많은 생성 횟수가 필요한 계정에 맞는 최고 등급 플랜입니다.",
    label: "Pro",
    maxMediaDurationSeconds: 300,
  },
};

export const allowlistSchemaSql = `
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
`;

const allowlistMigrations: Array<{ column: string; sql: string }> = [
  {
    column: "name",
    sql: "ALTER TABLE allowlist_users ADD COLUMN name TEXT",
  },
  {
    column: "role",
    sql: "ALTER TABLE allowlist_users ADD COLUMN role TEXT NOT NULL DEFAULT 'basic'",
  },
  {
    column: "status",
    sql: "ALTER TABLE allowlist_users ADD COLUMN status TEXT NOT NULL DEFAULT 'approved'",
  },
  {
    column: "requested_plan",
    sql: "ALTER TABLE allowlist_users ADD COLUMN requested_plan TEXT",
  },
  {
    column: "requested_at",
    sql: "ALTER TABLE allowlist_users ADD COLUMN requested_at TEXT",
  },
  {
    column: "approved_at",
    sql: "ALTER TABLE allowlist_users ADD COLUMN approved_at TEXT",
  },
  {
    column: "updated_at",
    sql: "ALTER TABLE allowlist_users ADD COLUMN updated_at TEXT",
  },
];

let allowlistReadyPromise: Promise<void> | null = null;

function isValidEmail(email: string) {
  return emailPattern.test(email);
}

function isAccessRole(role: string): role is AccessRole {
  return accessRoles.includes(role as AccessRole);
}

function isAccessStatus(status: string): status is AccessStatus {
  return accessStatuses.includes(status as AccessStatus);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getRoleFeatures(role: AccessRole) {
  return roleFeatures[role];
}

async function ensureAllowlistColumns() {
  const result = await getDb().execute("PRAGMA table_info(allowlist_users)");
  const columns = new Set(result.rows.map((row) => String(row.name)));

  for (const migration of allowlistMigrations) {
    if (!columns.has(migration.column)) {
      await getDb().execute(migration.sql);
    }
  }

  await getDb().execute(`
    UPDATE allowlist_users
    SET
      role = CASE
        WHEN role IN ('free', 'basic', 'plus', 'pro') THEN role
        ELSE 'basic'
      END,
      status = CASE
        WHEN status IN ('pending', 'approved') THEN status
        ELSE 'approved'
      END,
      requested_plan = CASE
        WHEN requested_plan IN ('free', 'basic', 'plus', 'pro') THEN requested_plan
        ELSE NULL
      END,
      requested_at = COALESCE(requested_at, created_at),
      approved_at = CASE
        WHEN COALESCE(status, 'approved') = 'approved' THEN COALESCE(approved_at, created_at)
        ELSE approved_at
      END,
      updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)
  `);
}

export async function ensureAllowlistTable() {
  if (!allowlistReadyPromise) {
    allowlistReadyPromise = (async () => {
      await getDb().execute(allowlistSchemaSql);
      await ensureAllowlistColumns();
    })();
  }

  return allowlistReadyPromise;
}

function mapRowToEntry(row: Record<string, unknown>) {
  const role = String(row.role ?? "free");
  const status = String(row.status ?? "pending");
  const requestedPlan = row.requested_plan ? String(row.requested_plan) : null;

  return {
    approvedAt: row.approved_at ? String(row.approved_at) : null,
    createdAt: row.created_at ? String(row.created_at) : null,
    email: String(row.email),
    name: row.name ? String(row.name) : null,
    requestedAt: row.requested_at ? String(row.requested_at) : null,
    requestedPlan:
      requestedPlan && isAccessRole(requestedPlan) ? requestedPlan : null,
    role: isAccessRole(role) ? role : "free",
    status: isAccessStatus(status) ? status : "pending",
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  } satisfies AllowlistEntry;
}

export async function findAllowlistEntryByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail)) {
    return null;
  }

  await ensureAllowlistTable();

  const result = await getDb().execute({
    sql: `
      SELECT
        email,
        name,
        role,
        status,
        requested_plan,
        requested_at,
        approved_at,
        created_at,
        updated_at
      FROM allowlist_users
      WHERE email = ?
      LIMIT 1
    `,
    args: [normalizedEmail],
  });

  if (result.rows.length === 0) {
    return null;
  }

  return mapRowToEntry(result.rows[0]);
}

export function compareRoleLevel(
  targetRole: AccessRole,
  currentRole: AccessRole,
) {
  return accessRoleRank[targetRole] - accessRoleRank[currentRole];
}

export async function submitPlanRequest(input: {
  email: string;
  name?: string | null;
  targetPlan: AccessRole;
}) {
  const email = normalizeEmail(input.email);
  const name = input.name?.trim() || null;
  const targetPlan = input.targetPlan;

  if (!isValidEmail(email)) {
    throw new Error("올바른 이메일 형식이 아닙니다.");
  }

  await ensureAllowlistTable();

  const existingEntry = await findAllowlistEntryByEmail(email);
  const currentRole = existingEntry?.role ?? "free";

  if (
    compareRoleLevel(targetPlan, currentRole) <= 0 &&
    existingEntry?.status !== "pending"
  ) {
    return {
      entry: existingEntry,
      state: "same_or_lower" as const,
    };
  }

  if (
    existingEntry?.status === "pending" &&
    existingEntry.requestedPlan === targetPlan
  ) {
    return {
      entry: existingEntry,
      state: "pending" as const,
    };
  }

  if (existingEntry) {
    await getDb().execute({
      sql: `
        UPDATE allowlist_users
        SET
          name = COALESCE(?, name),
          status = CASE
            WHEN status = 'approved' THEN 'approved'
            ELSE 'pending'
          END,
          requested_plan = ?,
          requested_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE email = ?
      `,
      args: [name, targetPlan, email],
    });

    return {
      entry: await findAllowlistEntryByEmail(email),
      state: "updated" as const,
    };
  }

  await getDb().execute({
    sql: `
      INSERT INTO allowlist_users (
        email,
        name,
        role,
        status,
        requested_plan,
        requested_at,
        created_at,
        updated_at
      )
      VALUES (?, ?, 'free', 'pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    args: [email, name, targetPlan],
  });

  return {
    entry: await findAllowlistEntryByEmail(email),
    state: "created" as const,
  };
}
