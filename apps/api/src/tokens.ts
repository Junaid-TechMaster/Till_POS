import { importPKCS8, jwtVerify, SignJWT } from "jose";
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
