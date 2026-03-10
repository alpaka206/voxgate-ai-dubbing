import { createClient, type Client } from "@libsql/client";

let cachedClient: Client | undefined;

function getEnv(name: "TURSO_DATABASE_URL" | "TURSO_AUTH_TOKEN") {
  const value = process.env[name];

  if (!value) {
    throw new Error(`환경 변수가 설정되지 않았습니다. ${name}`);
  }

  return value;
}

export function getDb() {
  if (!cachedClient) {
    cachedClient = createClient({
      url: getEnv("TURSO_DATABASE_URL"),
      authToken: getEnv("TURSO_AUTH_TOKEN"),
    });
  }

  return cachedClient;
}
