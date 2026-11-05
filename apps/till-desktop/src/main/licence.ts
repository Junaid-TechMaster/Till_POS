import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { hostname, platform } from "node:os";
import { join } from "node:path";
import { app, safeStorage } from "electron";
import {
  APP_VERSION,
  CLOCK_SKEW_MS,
  evaluateLicence,
  LICENCE_CHECK_INTERVAL_MS,
  type LicenceClaims,
  type LicenceView,
} from "@tillpro/shared";
import { compactVerify, decodeJwt, importSPKI } from "jose";
import { setShopAdmin } from "./db";

interface StoredLicence {
  token: string;
  lastSeenServerMs: number;
}

export interface LicenceState {
  activated: boolean;
  status: LicenceView["status"];
  locked: boolean;
  label: string;
  banner: string | null;
  lockMessage: string | null;
}

let lastNetworkAttempt = 0;
let cached: LicenceState | null = null;

function resource(name: string): string {
  const candidates = [
    join(app.getAppPath(), "resources", name),
    join(__dirname, "../../resources", name),
  ];
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error(`Missing ${name}`);
  return readFileSync(found, "utf8").trim();
}

export function apiBaseUrl(): string {
  const fromEnv = process.env.TILLPRO_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  try {
    return resource("api-base-url.txt").replace(/\/$/, "");
  } catch {
    return "http://127.0.0.1:8787";
  }
}

export function deviceFingerprint(): string {
  let source = `${hostname()}|${platform()}`;
  if (process.platform === "win32") {
    try {
      const output = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', {
        encoding: "utf8",
      });
      const match = /MachineGuid\s+REG_SZ\s+(\S+)/.exec(output);
      if (match) source = match[1] ?? source;
    } catch {
      source = `${source}|fallback`;
    }
  }
  return createHash("sha256").update(source).digest("hex");
}

function storePath(): string {
  return join(app.getPath("userData"), "licence.bin");
}

function readStored(): StoredLicence | null {
  if (!existsSync(storePath())) return null;
  try {
    const raw = readFileSync(storePath());
    const text = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString("utf8");
    const parsed = JSON.parse(text) as StoredLicence;
    if (!parsed.token || typeof parsed.lastSeenServerMs !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(stored: StoredLicence): void {
  const text = JSON.stringify(stored);
  const raw = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(text) : Buffer.from(text);
  writeFileSync(storePath(), raw);
}

async function claimsFrom(token: string): Promise<LicenceClaims | null> {
  try {
    const key = await importSPKI(resource("license-public.pem"), "RS256");
    await compactVerify(token, key);
    const payload = decodeJwt(token);
    const status = payload.status;
    if (
      typeof payload.sub !== "string" ||
      typeof payload.deviceId !== "string" ||
      typeof status !== "string" ||
      typeof payload.trialEndsAt !== "string" ||
      typeof payload.currentPeriodEnd !== "string" ||
      typeof payload.graceEndsAt !== "string" ||
      typeof payload.offlineAllowanceHours !== "number" ||
      typeof payload.serverTime !== "string"
    ) {
      return null;
    }
    if (payload.deviceId !== deviceFingerprint()) return null;
    return {
      status: status as LicenceClaims["status"],
      trialEndsAt: payload.trialEndsAt,
      currentPeriodEnd: payload.currentPeriodEnd,
      graceEndsAt: payload.graceEndsAt,
      offlineAllowanceHours: payload.offlineAllowanceHours,
      serverTime: payload.serverTime,
    };
  } catch {
    return null;
  }
}

function viewFor(claims: LicenceClaims | null, stored: StoredLicence | null): LicenceView {
  if (!claims || !stored) {
    return evaluateLicence(null, { nowMs: Date.now(), lastSeenServerMs: null, lastSuccessfulCheckMs: null });
  }
  const signedAt = Date.parse(claims.serverTime);
  return evaluateLicence(claims, {
    nowMs: Date.now(),
    lastSeenServerMs: Math.max(stored.lastSeenServerMs, signedAt),
    lastSuccessfulCheckMs: signedAt,
  });
}

async function acceptToken(token: string, previous: StoredLicence | null): Promise<LicenceState> {
  const claims = await claimsFrom(token);
  if (!claims) {
    return {
      activated: false,
      status: "UNACTIVATED",
      locked: true,
      label: "Not activated",
      banner: null,
      lockMessage: "The licence token could not be verified.",
    };
  }
  const signedAt = Date.parse(claims.serverTime);
  if (previous && signedAt + CLOCK_SKEW_MS < previous.lastSeenServerMs) {
    const current = await localState(previous);
    return { ...current, lockMessage: current.lockMessage ?? "An older licence token was rejected." };
  }
  const stored = { token, lastSeenServerMs: Math.max(previous?.lastSeenServerMs ?? signedAt, signedAt) };
  writeStored(stored);
  const view = viewFor(claims, stored);
  return { activated: true, ...view };
}

async function localState(stored: StoredLicence | null): Promise<LicenceState> {
  if (!stored) {
    return {
      activated: false,
      status: "UNACTIVATED",
      locked: true,
      label: "Not activated",
      banner: null,
      lockMessage: null,
    };
  }
  const claims = await claimsFrom(stored.token);
  const view = viewFor(claims, stored);
  return { activated: Boolean(claims), ...view };
}

async function refreshOnline(stored: StoredLicence): Promise<LicenceState | null> {
  const claims = await claimsFrom(stored.token);
  if (!claims) return null;
  const payload = decodeJwt(stored.token);
  const response = await fetch(`${apiBaseUrl()}/license/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientCode: payload.sub,
      deviceId: deviceFingerprint(),
      appVersion: APP_VERSION,
    }),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { token?: string };
  if (!body.token) return null;
  return acceptToken(body.token, stored);
}

function remember(state: LicenceState): LicenceState {
  cached = state;
  return state;
}

export async function licenceState(force = false): Promise<LicenceState> {
  const stored = readStored();
  const due = force || Date.now() - lastNetworkAttempt >= LICENCE_CHECK_INTERVAL_MS;
  if (stored && due) {
    lastNetworkAttempt = Date.now();
    try {
      const refreshed = await refreshOnline(stored);
      if (refreshed) return remember(refreshed);
    } catch {
      // Stay on the last signed token until the offline allowance runs out.
    }
  }
  return remember(await localState(stored));
}

export async function activateLicence(username: string, password: string): Promise<LicenceState> {
  const response = await fetch(`${apiBaseUrl()}/license/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      password,
      deviceId: deviceFingerprint(),
      deviceName: hostname(),
      appVersion: APP_VERSION,
    }),
  });
  const body = (await response.json()) as { token?: string; error?: string };
  if (!response.ok || !body.token) {
    return remember({
      activated: false,
      status: "UNACTIVATED",
      locked: true,
      label: "Not activated",
      banner: null,
      lockMessage: body.error ?? "Sign-in failed.",
    });
  }
  lastNetworkAttempt = Date.now();
  const state = await acceptToken(body.token, readStored());
  if (state.activated) setShopAdmin(username, password);
  return remember(state);
}

export function assertSalesAllowed(): void {
  if (!cached?.activated || cached.locked) {
    throw new Error(cached?.lockMessage || "Subscription inactive. Please contact your provider to restore access.");
  }
}
