import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(): void {
  const path = resolve(".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] != null) continue;
    process.env[key] = trimmed.slice(eq + 1).trim();
  }
}

loadEnvFile();

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

function privateKey(): string {
  const inline = process.env.LICENCE_PRIVATE_KEY;
  if (inline) return inline.replace(/\\n/g, "\n");
  const path = process.env.LICENCE_PRIVATE_KEY_PATH ?? "./keys/licence-private.pem";
  return readFileSync(resolve(path), "utf8");
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  adminEmail: process.env.ADMIN_EMAIL ?? "",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  adminOrigin: process.env.ADMIN_ORIGIN ?? "http://localhost:5174",
  port: Number(process.env.PORT ?? 8787),
  nodeEnv: process.env.NODE_ENV ?? "development",
  licencePrivateKey: privateKey(),
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "",
};
