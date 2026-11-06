import { createPublicKey } from "node:crypto";
import { importPKCS8, importSPKI, jwtVerify, SignJWT } from "jose";
import type { LicenceStatus } from "@tillpro/shared";
import { env } from "./env.js";

export interface AdminToken {
  sub: string;
  email: string;
  role: "SuperAdmin" | "Support";
}

export interface LicenceTokenInput {
  clientCode: string;
  deviceId: string;
  status: LicenceStatus;
  trialEndsAt: Date;
  currentPeriodEnd: Date;
  graceEndsAt: Date;
  offlineAllowanceHours: number;
}

const adminKey = new TextEncoder().encode(env.jwtSecret);
let licenceKey: Awaited<ReturnType<typeof importPKCS8>> | null = null;

async function signingKey(): Promise<Awaited<ReturnType<typeof importPKCS8>>> {
  licenceKey ??= await importPKCS8(env.licencePrivateKey, "RS256");
  return licenceKey;
}

export async function signAdmin(admin: AdminToken): Promise<string> {
  return new SignJWT({ email: admin.email, role: admin.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(admin.sub)
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(adminKey);
}

export async function verifyAdmin(token: string): Promise<AdminToken> {
  const { payload } = await jwtVerify(token, adminKey, { algorithms: ["HS256"] });
  const role = payload.role === "Support" ? "Support" : "SuperAdmin";
  return { sub: String(payload.sub), email: String(payload.email ?? ""), role };
}

export async function verifyLicence(token: string): Promise<{ clientCode: string; deviceId: string } | null> {
  try {
    const pem = createPublicKey(env.licencePrivateKey).export({ type: "spki", format: "pem" });
    const key = await importSPKI(pem.toString(), "RS256");
    const { payload } = await jwtVerify(token, key, { algorithms: ["RS256"] });
    if (typeof payload.sub !== "string" || typeof payload.deviceId !== "string") return null;
    return { clientCode: payload.sub, deviceId: payload.deviceId };
  } catch {
    return null;
  }
}

export async function signLicence(input: LicenceTokenInput): Promise<string> {
  const serverTime = new Date().toISOString();
  return new SignJWT({
    deviceId: input.deviceId,
    status: input.status,
    trialEndsAt: input.trialEndsAt.toISOString(),
    currentPeriodEnd: input.currentPeriodEnd.toISOString(),
    graceEndsAt: input.graceEndsAt.toISOString(),
    offlineAllowanceHours: input.offlineAllowanceHours,
    serverTime,
  })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(input.clientCode)
    .setIssuedAt()
    .setExpirationTime(`${input.offlineAllowanceHours}h`)
    .sign(await signingKey());
}
