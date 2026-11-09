import {
  APP_VERSION,
  DEFAULT_GRACE_DAYS,
  DEFAULT_MONTHLY_PRICE_PENCE,
  DEFAULT_OFFLINE_ALLOWANCE_HOURS,
  DEFAULT_TRIAL_DAYS,
} from "@tillpro/shared";
import { env } from "../src/env.js";
import { hashPassword } from "../src/passwords.js";
import { prisma } from "../src/prisma.js";

const settings: Record<string, string> = {
  trialDays: String(DEFAULT_TRIAL_DAYS),
  graceDays: String(DEFAULT_GRACE_DAYS),
  offlineHours: String(DEFAULT_OFFLINE_ALLOWANCE_HOURS),
  defaultPricePence: String(DEFAULT_MONTHLY_PRICE_PENCE),
  latestVersion: APP_VERSION,
  downloadUrl: "",
  nextClientNumber: "0",
};

for (const [key, value] of Object.entries(settings)) {
  await prisma.setting.upsert({
    where: { key },
    update: {},
    create: { key, value },
  });
}

if (!env.adminEmail || !env.adminPassword) {
  console.log("ADMIN_EMAIL and ADMIN_PASSWORD are not set, so no dashboard user was created.");
} else {
  const email = env.adminEmail.toLowerCase();
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (!existing) {
    await prisma.adminUser.create({
      data: {
        email,
        passwordHash: await hashPassword(env.adminPassword),
        role: "SUPER_ADMIN",
      },
    });
    console.log(`Created SuperAdmin ${email}`);
  } else {
    console.log(`SuperAdmin ${email} already exists`);
  }
}

const demoUsername = "demo-shop";
const demoPassword = "DemoShop-12345";
const demoAccount = await prisma.clientAccount.findUnique({ where: { username: demoUsername } });
if (!demoAccount) {
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const graceEnd = new Date(trialEndsAt.getTime() + 2 * 24 * 60 * 60 * 1000);
  await prisma.client.create({
    data: {
      clientCode: "TP-000001",
      businessName: "TillPro Demo Shop",
      contactName: "Demo Manager",
      email: "demo@localhost",
      phone: "0161 496 0123",
      address: "12 Market Street, Manchester, M1 1AE",
      notes: "Demo shop for the installed till. Valid for 1 day.",
      status: "TRIAL",
      monthlyPricePence: 2900,
      account: {
        create: {
          username: demoUsername,
          passwordHash: await hashPassword(demoPassword),
        },
      },
      subscription: {
        create: {
          status: "TRIAL",
          trialEndsAt,
          currentPeriodEnd: trialEndsAt,
          graceEndsAt: graceEnd,
          maxDevices: 3,
          lastPaidAt: null,
        },
      },
    },
  });
  const counter = await prisma.setting.findUnique({ where: { key: "nextClientNumber" } });
  if (!counter || Number(counter.value) < 1) {
    await prisma.setting.update({ where: { key: "nextClientNumber" }, data: { value: "1" } });
  }
  console.log(`Demo shop username ${demoUsername}`);
} else {
  console.log(`Demo shop ${demoUsername} already exists`);
}

await prisma.$disconnect();
