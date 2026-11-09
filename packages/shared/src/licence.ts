import { LOCKED_LICENCE_STATUSES, type LicenceStatus } from "./constants.js";

/** A shop clock a few minutes slow is not an attempt to rewind a subscription. */
export const CLOCK_SKEW_MS = 15 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export const LOCK_MESSAGE =
  "Subscription inactive. Please contact your provider to restore access.";

export interface LicenceClaims {
  status: LicenceStatus;
  trialEndsAt: string;
  currentPeriodEnd: string;
  graceEndsAt: string;
  offlineAllowanceHours: number;
  serverTime: string;
}

export interface OfflineClock {
  nowMs: number;
  /** Highest server timestamp this PC has accepted. */
  lastSeenServerMs: number | null;
  /** Local time of the last signature check that succeeded. */
  lastSuccessfulCheckMs: number | null;
}

export type LocalLicenceStatus = LicenceStatus | "UNACTIVATED" | "OFFLINE_EXPIRED" | "CLOCK_TAMPER";

export interface LicenceView {
  status: LocalLicenceStatus;
  locked: boolean;
  label: string;
  banner: string | null;
  lockMessage: string | null;
}

export function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.ceil(ms / MINUTE_MS));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes - days * 60 * 24) / 60);
  const minutes = totalMinutes - days * 60 * 24 - hours * 60;
  const dayPart = `${days} day${days === 1 ? "" : "s"}`;
  const hourPart = `${hours} hour${hours === 1 ? "" : "s"}`;
  const minutePart = `${minutes} minute${minutes === 1 ? "" : "s"}`;
  if (days > 0) return `${dayPart} ${hourPart}`;
  if (hours > 0) return `${hourPart} ${minutePart}`;
  return minutePart;
}

export function graceBanner(remainingMs: number): string {
  return `Payment overdue. Software will lock in ${formatCountdown(remainingMs)}. Contact your provider.`;
}

export function duesBanner(remainingMs: number): string {
  const days = Math.max(1, Math.ceil(remainingMs / DAY_MS));
  const dayWord = days === 1 ? "1 day" : `${days} days`;
  return `${dayWord} left. Pay the dues to keep using this till.`;
}

export function trialLabel(remainingMs: number): string {
  if (remainingMs >= DAY_MS) {
    const days = Math.ceil(remainingMs / DAY_MS);
    return `Trial ${days} day${days === 1 ? "" : "s"} left`;
  }
  const hours = Math.max(1, Math.ceil(remainingMs / HOUR_MS));
  return `Trial ${hours} hour${hours === 1 ? "" : "s"} left`;
}

/** Move TRIAL / ACTIVE / GRACE forward from the dates. A manual lock stays locked. */
export function advanceSubscription(
  status: LicenceStatus,
  dates: { trialEndsAt: string; currentPeriodEnd: string; graceEndsAt: string },
  nowMs: number,
): LicenceStatus {
  if (status === "SUSPENDED" || status === "CANCELLED" || status === "EXPIRED") return status;
  const trialEnd = Date.parse(dates.trialEndsAt);
  const periodEnd = Date.parse(dates.currentPeriodEnd);
  const graceEnd = Date.parse(dates.graceEndsAt);
  if (status === "TRIAL") {
    if (nowMs < trialEnd) return "TRIAL";
    if (nowMs < graceEnd) return "GRACE";
    return "SUSPENDED";
  }
  if (nowMs < periodEnd) return "ACTIVE";
  if (nowMs < graceEnd) return "GRACE";
  return "SUSPENDED";
}

export function evaluateLicence(claims: LicenceClaims | null, clock: OfflineClock): LicenceView {
  if (!claims) {
    return {
      status: "UNACTIVATED",
      locked: true,
      label: "Not activated",
      banner: null,
      lockMessage: null,
    };
  }

  if (clock.lastSeenServerMs != null && clock.nowMs + CLOCK_SKEW_MS < clock.lastSeenServerMs) {
    return {
      status: "CLOCK_TAMPER",
      locked: true,
      label: "Clock error",
      banner: null,
      lockMessage:
        "The system clock is earlier than the last licence check. Correct the date and time, then connect to restore access.",
    };
  }

  const allowanceMs = claims.offlineAllowanceHours * HOUR_MS;
  if (
    clock.lastSuccessfulCheckMs == null ||
    clock.nowMs - clock.lastSuccessfulCheckMs > allowanceMs
  ) {
    return {
      status: "OFFLINE_EXPIRED",
      locked: true,
      label: "Offline expired",
      banner: null,
      lockMessage:
        "This till has been offline too long. Connect to the internet to confirm the subscription.",
    };
  }

  const status = advanceSubscription(claims.status, claims, clock.nowMs);
  if (LOCKED_LICENCE_STATUSES.includes(status)) {
    return { status, locked: true, label: "Inactive", banner: null, lockMessage: LOCK_MESSAGE };
  }

  if (status === "GRACE") {
    const remaining = Date.parse(claims.graceEndsAt) - clock.nowMs;
    return {
      status,
      locked: false,
      label: "Overdue",
      banner: graceBanner(remaining),
      lockMessage: null,
    };
  }

  if (status === "TRIAL" || status === "ACTIVE") {
    const end = status === "TRIAL" ? Date.parse(claims.trialEndsAt) : Date.parse(claims.currentPeriodEnd);
    const remaining = end - clock.nowMs;
    const banner = remaining > 0 && remaining <= 2 * DAY_MS ? duesBanner(remaining) : null;
    return {
      status,
      locked: false,
      label: status === "TRIAL" ? trialLabel(remaining) : "Active",
      banner,
      lockMessage: null,
    };
  }

  return { status, locked: false, label: "Active", banner: null, lockMessage: null };
}
