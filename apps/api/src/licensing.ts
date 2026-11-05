import { advanceSubscription, type LicenceStatus } from "@tillpro/shared";
import type { Client, Device, Subscription } from "@prisma/client";
import { prisma } from "./prisma.js";
import { hashPassword, randomPassword, randomUsername } from "./passwords.js";
import { addDays, addMonths, readSettings } from "./settings.js";
import { signLicence } from "./tokens.js";

const clientInclude = {
  account: true,
  subscription: true,
  devices: true,
} as const;

export type ClientBundle = Client & {
  account: { id: string; username: string; createdAt: Date } | null;
  subscription: Subscription | null;
  devices: Device[];
};

export async function audit(actorId: string, action: string, detail: string, clientId?: string): Promise<void> {
  await prisma.auditLog.create({ data: { actorId, action, detail, clientId: clientId ?? null } });
}

async function setStatus(clientId: string, status: string): Promise<void> {
  await prisma.$transaction([
    prisma.client.update({ where: { id: clientId }, data: { status } }),
    prisma.subscription.update({ where: { clientId }, data: { status } }),
  ]);
}

export async function refreshStatuses(): Promise<number> {
  const subscriptions = await prisma.subscription.findMany();
  let changed = 0;
  for (const subscription of subscriptions) {
    const next = advanceSubscription(
      subscription.status as LicenceStatus,
      {
        trialEndsAt: subscription.trialEndsAt.toISOString(),
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        graceEndsAt: subscription.graceEndsAt.toISOString(),
      },
      Date.now(),
    );
    if (next === subscription.status) continue;
    await setStatus(subscription.clientId, next);
    await audit("system", "status.auto", `${subscription.status} -> ${next}`, subscription.clientId);
    changed += 1;
  }
  return changed;
}

async function nextClientCode(): Promise<string> {
  await prisma.setting.upsert({
    where: { key: "nextClientNumber" },
    update: {},
    create: { key: "nextClientNumber", value: "0" },
  });
  const rows = await prisma.$queryRaw<{ value: string }[]>`
    UPDATE "Setting"
    SET "value" = ("value"::int + 1)::text
    WHERE "key" = 'nextClientNumber'
    RETURNING "value"
  `;
  const issued = Number(rows[0]?.value ?? 1);
  return `TP-${String(issued).padStart(6, "0")}`;
}

export async function accountsForLogin(login: string) {
  const name = login.trim();
  const exact = await prisma.clientAccount.findUnique({
    where: { username: name },
    include: { client: { include: clientInclude } },
  });
  const byEmail = name.includes("@")
    ? await prisma.clientAccount.findMany({
        where: { client: { email: { equals: name, mode: "insensitive" } } },
        include: { client: { include: clientInclude } },
      })
    : [];
  const seen = new Set<string>();
  const accounts = [];
  for (const account of [exact, ...byEmail]) {
    if (!account || seen.has(account.id)) continue;
    seen.add(account.id);
    accounts.push(account);
  }
  return accounts;
}

export async function createClient(input: {
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  monthlyPricePence: number;
  trialDays: number;
  actorId: string;
}): Promise<{ client: ClientBundle; username: string; password: string }> {
  const settings = await readSettings();
  const trialDays = input.trialDays > 0 ? input.trialDays : settings.trialDays;
  const now = new Date();
  const trialEndsAt = addDays(now, trialDays);
  const graceEndsAt = addDays(trialEndsAt, settings.graceDays);
  const password = randomPassword();
  const passwordHash = await hashPassword(password);
  let username = randomUsername(input.businessName);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const taken = await prisma.clientAccount.findUnique({ where: { username } });
    if (!taken) break;
    username = randomUsername(input.businessName);
  }

  const clientCode = await nextClientCode();
  const client = await prisma.client.create({
    data: {
      clientCode,
      businessName: input.businessName,
      contactName: input.contactName,
      email: input.email,
      phone: input.phone,
      address: input.address,
      notes: input.notes,
      status: "TRIAL",
      monthlyPricePence: input.monthlyPricePence,
      account: { create: { username, passwordHash } },
      subscription: {
        create: {
          status: "TRIAL",
          trialEndsAt,
          currentPeriodEnd: trialEndsAt,
          graceEndsAt,
          maxDevices: 1,
        },
      },
    },
    include: clientInclude,
  });
  await audit(input.actorId, "client.create", `${clientCode} ${username}`, client.id);
  return {
    client,
    username,
    password,
  };
}

export async function markPaid(input: {
  clientId: string;
  amountPence: number;
  method: string;
  reference: string;
  periodEnd: Date | null;
  paidAt: Date;
  actorId: string;
}): Promise<void> {
  const settings = await readSettings();
  const subscription = await prisma.subscription.findUniqueOrThrow({ where: { clientId: input.clientId } });
  const periodStart = subscription.currentPeriodEnd > input.paidAt ? subscription.currentPeriodEnd : input.paidAt;
  const periodEnd = input.periodEnd ?? addMonths(periodStart, 1);
  const graceEndsAt = addDays(periodEnd, settings.graceDays);
  await prisma.$transaction([
    prisma.subscription.update({
      where: { clientId: input.clientId },
      data: {
        status: "ACTIVE",
        currentPeriodEnd: periodEnd,
        graceEndsAt,
        lastPaidAt: input.paidAt,
      },
    }),
    prisma.client.update({ where: { id: input.clientId }, data: { status: "ACTIVE" } }),
    prisma.payment.create({
      data: {
        clientId: input.clientId,
        amountPence: input.amountPence,
        method: input.method,
        reference: input.reference,
        paidAt: input.paidAt,
        periodStart,
        periodEnd,
        recordedBy: input.actorId,
      },
    }),
  ]);
  await audit(input.actorId, "payment.mark", `${input.method} ${input.amountPence}`, input.clientId);
}

export async function issueForDevice(client: ClientBundle, device: { deviceId: string; blocked: boolean }): Promise<string> {
  const settings = await readSettings();
  const subscription = client.subscription;
  if (!subscription) throw new Error("Client has no subscription");
  const status = (device.blocked ? "SUSPENDED" : subscription.status) as LicenceStatus;
  return signLicence({
    clientCode: client.clientCode,
    deviceId: device.deviceId,
    status,
    trialEndsAt: subscription.trialEndsAt,
    currentPeriodEnd: subscription.currentPeriodEnd,
    graceEndsAt: subscription.graceEndsAt,
    offlineAllowanceHours: settings.offlineHours,
  });
}

export { clientInclude };
