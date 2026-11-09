import { describe, expect, it } from "vitest";
import { LOCK_MESSAGE, evaluateLicence, type LicenceClaims, type OfflineClock } from "./licence.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const baseClaims: LicenceClaims = {
  status: "ACTIVE",
  trialEndsAt: "2026-11-01T00:00:00.000Z",
  currentPeriodEnd: "2026-12-01T00:00:00.000Z",
  graceEndsAt: "2026-12-03T00:00:00.000Z",
  offlineAllowanceHours: 48,
  serverTime: "2026-11-05T00:00:00.000Z",
};

function clock(nowMs: number, lastCheckMs: number, lastServerMs = lastCheckMs): OfflineClock {
  return { nowMs, lastSuccessfulCheckMs: lastCheckMs, lastSeenServerMs: lastServerMs };
}

describe("evaluateLicence", () => {
  it("shows a trial countdown and keeps the till open", () => {
    const now = Date.parse("2026-11-05T00:00:00.000Z");
    const view = evaluateLicence(
      {
        ...baseClaims,
        status: "TRIAL",
        trialEndsAt: new Date(now + 2 * DAY).toISOString(),
        graceEndsAt: new Date(now + 4 * DAY).toISOString(),
      },
      clock(now, now),
    );
    expect(view.status).toBe("TRIAL");
    expect(view.locked).toBe(false);
    expect(view.label).toBe("Trial 2 days left");
    expect(view.banner).toBe("2 days left. Pay the dues to keep using this till.");
  });

  it("stays quiet while more than two days remain", () => {
    const now = Date.parse("2026-11-05T00:00:00.000Z");
    const view = evaluateLicence(
      {
        ...baseClaims,
        status: "TRIAL",
        trialEndsAt: new Date(now + 3 * DAY).toISOString(),
        graceEndsAt: new Date(now + 5 * DAY).toISOString(),
      },
      clock(now, now),
    );
    expect(view.banner).toBeNull();
  });

  it("warns an active shop when two days of the paid period remain", () => {
    const now = Date.parse("2026-11-29T00:00:00.000Z");
    const view = evaluateLicence(baseClaims, clock(now, now));
    expect(view.status).toBe("ACTIVE");
    expect(view.locked).toBe(false);
    expect(view.banner).toBe("2 days left. Pay the dues to keep using this till.");
  });

  it("keeps an active subscription open", () => {
    const now = Date.parse("2026-11-05T00:00:00.000Z");
    const view = evaluateLicence(baseClaims, clock(now, now));
    expect(view.status).toBe("ACTIVE");
    expect(view.locked).toBe(false);
    expect(view.label).toBe("Active");
  });

  it("shows the overdue banner during grace and still allows sales", () => {
    const now = Date.parse("2026-12-01T20:00:00.000Z");
    const view = evaluateLicence(baseClaims, clock(now, now));
    expect(view.status).toBe("GRACE");
    expect(view.locked).toBe(false);
    expect(view.label).toBe("Overdue");
    expect(view.banner).toBe(
      "Payment overdue. Software will lock in 1 day 4 hours. Contact your provider.",
    );
  });

  it("locks when grace has ended", () => {
    const now = Date.parse("2026-12-04T00:00:00.000Z");
    const view = evaluateLicence({ ...baseClaims, status: "GRACE" }, clock(now, now));
    expect(view.status).toBe("SUSPENDED");
    expect(view.locked).toBe(true);
    expect(view.lockMessage).toBe(LOCK_MESSAGE);
  });

  it("keeps a manual suspension locked even when the paid period is still in the future", () => {
    const now = Date.parse("2026-11-05T00:00:00.000Z");
    const view = evaluateLicence({ ...baseClaims, status: "SUSPENDED" }, clock(now, now));
    expect(view.locked).toBe(true);
    expect(view.status).toBe("SUSPENDED");
    expect(view.lockMessage).toBe(LOCK_MESSAGE);
  });

  it("locks when the clock is set earlier than the last server time", () => {
    const server = Date.parse("2026-11-05T12:00:00.000Z");
    const now = server - DAY;
    const view = evaluateLicence(baseClaims, clock(now, now, server));
    expect(view.status).toBe("CLOCK_TAMPER");
    expect(view.locked).toBe(true);
  });

  it("locks after the offline allowance even if the saved status is active", () => {
    const now = Date.parse("2026-11-05T00:00:00.000Z");
    const view = evaluateLicence(baseClaims, clock(now, now - 49 * HOUR, now - 49 * HOUR));
    expect(view.status).toBe("OFFLINE_EXPIRED");
    expect(view.locked).toBe(true);
  });

  it("stays open inside the offline allowance", () => {
    const now = Date.parse("2026-11-05T00:00:00.000Z");
    const view = evaluateLicence(baseClaims, clock(now, now - 47 * HOUR, now - 47 * HOUR));
    expect(view.status).toBe("ACTIVE");
    expect(view.locked).toBe(false);
  });
});
