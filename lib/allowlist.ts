import { getDb } from "@/lib/db";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AccessRole = "manager" | "member";
export type AccessRequestStatus = "pending" | "approved";
export type MembershipStatus = "approved" | "pending" | "not_requested";

export const servicePolicy = {
  dailyGenerationLimit: 10,
  maxMediaDurationSeconds: 180,
} as const;

export type AllowlistEntry = {
  createdAt: string | null;
  email: string;
  name: string | null;
  role: AccessRole;
};

export type AccessRequestEntry = {
  createdAt: string | null;
  email: string;
  name: string | null;
  status: AccessRequestStatus;
  updatedAt: string | null;
};

export const allowlistSchemaSql = `
  CREATE TABLE IF NOT EXISTS allowlist_users (
    email TEXT PRIMARY KEY COLLATE NOCASE,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`;

export const accessRequestSchemaSql = `
  CREATE TABLE IF NOT EXISTS access_requests (
    email TEXT PRIMARY KEY COLLATE NOCASE,
    name TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`;

let allowlistReadyPromise: Promise<void> | null = null;

function isValidEmail(email: string) {
  return emailPattern.test(email);
}

function isAccessRole(role: string): role is AccessRole {
  return role === "manager" || role === "member";
}

function isAccessRequestStatus(status: string): status is AccessRequestStatus {
  return status === "pending" || status === "approved";
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function ensureAllowlistTables() {
  if (!allowlistReadyPromise) {
    allowlistReadyPromise = (async () => {
      await getDb().execute(allowlistSchemaSql);
      await getDb().execute(accessRequestSchemaSql);
    })();
  }

  return allowlistReadyPromise;
}

function mapRowToAllowlistEntry(row: Record<string, unknown>) {
  const role = String(row.role ?? "member");

  return {
    createdAt: row.created_at ? String(row.created_at) : null,
    email: String(row.email),
    name: row.name ? String(row.name) : null,
    role: isAccessRole(role) ? role : "member",
  } satisfies AllowlistEntry;
}

function mapRowToAccessRequestEntry(row: Record<string, unknown>) {
  const status = String(row.status ?? "pending");

  return {
    createdAt: row.created_at ? String(row.created_at) : null,
    email: String(row.email),
    name: row.name ? String(row.name) : null,
    status: isAccessRequestStatus(status) ? status : "pending",
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  } satisfies AccessRequestEntry;
}

export async function findAllowlistEntryByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail)) {
    return null;
  }

  await ensureAllowlistTables();

  const result = await getDb().execute({
    sql: `
      SELECT email, name, role, created_at
      FROM allowlist_users
      WHERE email = ?
      LIMIT 1
    `,
    args: [normalizedEmail],
  });

  if (result.rows.length === 0) {
    return null;
  }

  return mapRowToAllowlistEntry(result.rows[0]);
}

export async function findAccessRequestByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail)) {
    return null;
  }

  await ensureAllowlistTables();

  const result = await getDb().execute({
    sql: `
      SELECT email, name, status, created_at, updated_at
      FROM access_requests
      WHERE email = ?
      LIMIT 1
    `,
    args: [normalizedEmail],
  });

  if (result.rows.length === 0) {
    return null;
  }

  return mapRowToAccessRequestEntry(result.rows[0]);
}

export async function listAllowlistEntries() {
  await ensureAllowlistTables();

  const result = await getDb().execute(`
    SELECT email, name, role, created_at
    FROM allowlist_users
    ORDER BY
      CASE role WHEN 'manager' THEN 0 ELSE 1 END,
      created_at ASC,
      email ASC
  `);

  return result.rows.map((row) => mapRowToAllowlistEntry(row));
}

export async function listPendingAccessRequests() {
  await ensureAllowlistTables();

  const result = await getDb().execute(`
    SELECT email, name, status, created_at, updated_at
    FROM access_requests
    WHERE status = 'pending'
    ORDER BY created_at ASC, email ASC
  `);

  return result.rows.map((row) => mapRowToAccessRequestEntry(row));
}

export async function submitAccessRequest(input: {
  email: string;
  name?: string | null;
}) {
  const email = normalizeEmail(input.email);
  const name = input.name?.trim() || null;

  if (!isValidEmail(email)) {
    throw new Error("올바른 이메일 형식이 아닙니다.");
  }

  await ensureAllowlistTables();

  const existingAllowlistEntry = await findAllowlistEntryByEmail(email);

  if (existingAllowlistEntry) {
    return {
      entry: existingAllowlistEntry,
      state: "already_allowed" as const,
    };
  }

  const existingRequest = await findAccessRequestByEmail(email);

  if (existingRequest?.status === "pending") {
    return {
      entry: existingRequest,
      state: "already_requested" as const,
    };
  }

  await getDb().execute({
    sql: `
      INSERT INTO access_requests (email, name, status, created_at, updated_at)
      VALUES (?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(email) DO UPDATE SET
        name = COALESCE(excluded.name, access_requests.name),
        status = 'pending',
        updated_at = CURRENT_TIMESTAMP
    `,
    args: [email, name],
  });

  return {
    entry: await findAccessRequestByEmail(email),
    state: "created" as const,
  };
}

export async function grantMemberAccess(input: {
  email: string;
  name?: string | null;
}) {
  const email = normalizeEmail(input.email);
  const name = input.name?.trim() || null;

  if (!isValidEmail(email)) {
    throw new Error("올바른 이메일 형식이 아닙니다.");
  }

  await ensureAllowlistTables();

  await getDb().execute({
    sql: `
      INSERT INTO allowlist_users (email, name, role, created_at)
      VALUES (?, ?, 'member', CURRENT_TIMESTAMP)
      ON CONFLICT(email) DO UPDATE SET
        name = COALESCE(excluded.name, allowlist_users.name)
    `,
    args: [email, name],
  });

  await getDb().execute({
    sql: `
      UPDATE access_requests
      SET
        status = 'approved',
        updated_at = CURRENT_TIMESTAMP
      WHERE email = ?
    `,
    args: [email],
  });

  return findAllowlistEntryByEmail(email);
}
