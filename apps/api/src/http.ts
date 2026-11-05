import { createHash } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { formatGbp, PRODUCT_NAME, type LicenceStatus } from "@tillpro/shared";
import { prisma } from "./prisma.js";
import { hashPassword, verifyPassword } from "./passwords.js";
import { addDays, readSettings, writeSettings, type ShopLicenceSettings } from "./settings.js";
import { signAdmin, verifyAdmin, type AdminToken } from "./tokens.js";
import {
  audit,
  clientInclude,
  createClient,
  issueForDevice,
  markPaid,
  refreshStatuses,
  type ClientBundle,
} from "./licensing.js";

const loginLimit = { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } };
const emailField = z
  .string()
  .trim()
  .min(3)
  .max(200)
  .regex(/^[^\s@]+@[^\s@]+$/, "Enter an email.");

export function clientJson(client: ClientBundle) {
  const lastSeen = client.devices.reduce<Date | null>((latest, device) => {
    if (!latest || device.lastSeenAt > latest) return device.lastSeenAt;
    return latest;
  }, null);
  return {
    id: client.id,
    clientCode: client.clientCode,
    businessName: client.businessName,
    contactName: client.contactName,
    email: client.email,
    phone: client.phone,
    address: client.address,
    notes: client.notes,
    status: client.subscription?.status ?? client.status,
    monthlyPricePence: client.monthlyPricePence,
    currency: client.currency,
    createdAt: client.createdAt.toISOString(),
    username: client.account?.username ?? "",
    subscription: client.subscription
      ? {
          plan: client.subscription.plan,
          status: client.subscription.status,
          trialEndsAt: client.subscription.trialEndsAt.toISOString(),
          currentPeriodEnd: client.subscription.currentPeriodEnd.toISOString(),
          graceEndsAt: client.subscription.graceEndsAt.toISOString(),
          maxDevices: client.subscription.maxDevices,
          lastPaidAt: client.subscription.lastPaidAt?.toISOString() ?? null,
        }
      : null,
    devices: client.devices.map((device) => ({
      id: device.id,
      deviceId: device.deviceId,
      name: device.name,
      firstSeenAt: device.firstSeenAt.toISOString(),
      lastSeenAt: device.lastSeenAt.toISOString(),
      lastIp: device.lastIp,
      appVersion: device.appVersion,
      status: device.status,
    })),
    deviceCount: client.devices.length,
    lastSeenAt: lastSeen?.toISOString() ?? null,
  };
}

async function adminOf(request: FastifyRequest, reply: FastifyReply): Promise<AdminToken | null> {
  const header = request.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    void reply.code(401).send({ error: "Sign in required." });
    return null;
  }
  try {
    return await verifyAdmin(token);
  } catch {
    void reply.code(401).send({ error: "Sign in required." });
    return null;
  }
}

function welcome(input: {
  clientCode: string;
  username: string;
  password: string;
  downloadUrl: string;
}): string {
  return [
    `Your ${PRODUCT_NAME} login`,
    "",
    `Client ID: ${input.clientCode}`,
    `Username: ${input.username}`,
    `Password: ${input.password}`,
    `Download: ${input.downloadUrl || "(add the download link in Settings)"}`,
    "",
    "Sign in with this username and password the first time the till starts.",
    "After that, shop staff sign in with their own ID and PIN.",
    "Keep this password private. It works only for this shop and the devices you allow.",
  ].join("\n");
}

export async function registerRoutes(app: import("fastify").FastifyInstance): Promise<void> {
  app.get("/health", async () => ({ ok: true, product: PRODUCT_NAME }));

  app.post("/admin/login", loginLimit, async (request, reply) => {
    const body = z.object({ email: emailField, password: z.string().min(1).max(200) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Enter an email and password." });
    const admin = await prisma.adminUser.findUnique({ where: { email: body.data.email.toLowerCase() } });
    const valid = admin ? await verifyPassword(admin.passwordHash, body.data.password) : false;
    if (!admin || !valid) return reply.code(401).send({ error: "Sign-in failed." });
    const role = admin.role === "SUPPORT" ? "Support" : "SuperAdmin";
    const token = await signAdmin({ sub: admin.id, email: admin.email, role });
    await audit(admin.id, "admin.login", admin.email);
    return { token, email: admin.email, role };
  });

  app.get("/admin/overview", async (request, reply) => {
    const admin = await adminOf(request, reply);
    if (!admin) return;
    await refreshStatuses();
    const clients = await prisma.client.findMany({ include: clientInclude });
    const now = Date.now();
    const week = now + 7 * 24 * 60 * 60 * 1000;
    const onlineAfter = now - 15 * 60 * 1000;
    const count = (status: string) => clients.filter((client) => client.subscription?.status === status).length;
    const mrr = clients
      .filter((client) => client.subscription?.status === "ACTIVE")
      .reduce((sum, client) => sum + client.monthlyPricePence, 0);
    const dueSoon = clients.filter((client) => {
      const end = client.subscription?.currentPeriodEnd.getTime() ?? 0;
      const status = client.subscription?.status;
      return (status === "ACTIVE" || status === "TRIAL") && end >= now && end <= week;
    }).length;
    const devicesOnline = clients.reduce(
      (sum, client) => sum + client.devices.filter((device) => device.status === "ACTIVE" && device.lastSeenAt.getTime() >= onlineAfter).length,
      0,
    );
    return {
      total: clients.length,
      active: count("ACTIVE"),
      trial: count("TRIAL"),
      grace: count("GRACE"),
      suspended: count("SUSPENDED"),
      mrrPence: mrr,
      dueSoon,
      devicesOnline,
    };
  });

  app.get("/admin/clients", async (request, reply) => {
    const admin = await adminOf(request, reply);
    if (!admin) return;
    const query = z
      .object({ q: z.string().optional(), status: z.string().optional() })
      .parse(request.query);
    const clients = await prisma.client.findMany({
      include: clientInclude,
      orderBy: { createdAt: "desc" },
    });
    const needle = query.q?.trim().toLowerCase() ?? "";
    return clients
      .map(clientJson)
      .filter((client) => (query.status ? client.status === query.status : true))
      .filter((client) => {
        if (!needle) return true;
        return [client.clientCode, client.businessName, client.contactName, client.email, client.username]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      });
  });

  app.post("/admin/clients", async (request, reply) => {
    const admin = await adminOf(request, reply);
    if (!admin) return;
    const body = z
      .object({
        businessName: z.string().min(1).max(160),
        contactName: z.string().min(1).max(160),
        email: emailField,
        phone: z.string().min(1).max(40),
        address: z.string().min(1).max(400),
        notes: z.string().max(2000).optional(),
        monthlyPricePence: z.number().int().positive(),
        trialDays: z.number().int().positive().max(90),
      })
      .safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Check the shop details and try again." });
    const settings = await readSettings();
    const created = await createClient({ ...body.data, notes: body.data.notes ?? "", actorId: admin.sub });
    return {
      client: clientJson(created.client),
      username: created.username,
      password: created.password,
      message: welcome({
        clientCode: created.client.clientCode,
        username: created.username,
        password: created.password,
        downloadUrl: settings.downloadUrl,
      }),
    };
  });

  app.get("/admin/clients/:id", async (request, reply) => {
    const admin = await adminOf(request, reply);
    if (!admin) return;
    const { id } = request.params as { id: string };
    const client = await prisma.client.findFirst({
      where: { OR: [{ id }, { clientCode: id }] },
      include: clientInclude,
    });
    if (!client) return reply.code(404).send({ error: "Client not found." });
    const [payments, logs] = await Promise.all([
      prisma.payment.findMany({ where: { clientId: client.id }, orderBy: { paidAt: "desc" } }),
      prisma.auditLog.findMany({ where: { clientId: client.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    return {
      client: clientJson(client),
      payments: payments.map((payment) => ({
        id: payment.id,
        amountPence: payment.amountPence,
        method: payment.method,
        reference: payment.reference,
        paidAt: payment.paidAt.toISOString(),
        periodStart: payment.periodStart.toISOString(),
        periodEnd: payment.periodEnd.toISOString(),
        recordedBy: payment.recordedBy,
      })),
      audit: logs.map((log) => ({
        id: log.id,
        action: log.action,
        detail: log.detail,
        actorId: log.actorId,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  });

  app.patch("/admin/clients/:id", async (request, reply) => {
    const admin = await adminOf(request, reply);
    if (!admin) return;
    const { id } = request.params as { id: string };
    const body = z
      .object({
        businessName: z.string().min(1).max(160),
        contactName: z.string().min(1).max(160),
        email: emailField,
        phone: z.string().min(1).max(40),
        address: z.string().min(1).max(400),
        notes: z.string().max(2000),
        monthlyPricePence: z.number().int().positive(),
      })
      .safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Check the shop details and try again." });
    const client = await prisma.client.update({ where: { id }, data: body.data, include: clientInclude });
    await audit(admin.sub, "client.update", client.clientCode, client.id);
    return clientJson(client);
  });

  app.post("/admin/clients/:id/suspend", async (request, reply) => {
    const admin = await adminOf(request, reply);
    if (!admin) return;
    const { id } = request.params as { id: string };
    await prisma.$transaction([
      prisma.client.update({ where: { id }, data: { status: "SUSPENDED" } }),
      prisma.subscription.update({ where: { clientId: id }, data: { status: "SUSPENDED" } }),
    ]);
    await audit(admin.sub, "client.suspend", id, id);
    return { ok: true };
  });

  app.post("/admin/clients/:id/reactivate", async (request, reply) => {
    const admin = await adminOf(request, reply);
    if (!admin) return;
    const { id } = request.params as { id: string };
    const settings = await readSettings();
    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { clientId: id } });
    const now = new Date();
    let status: LicenceStatus = "ACTIVE";
    let currentPeriodEnd = subscription.currentPeriodEnd;
    let graceEndsAt = subscription.graceEndsAt;
    if (subscription.status === "CANCELLED") {
      currentPeriodEnd = addMonthsFrom(now, 1);
      graceEndsAt = addDays(currentPeriodEnd, settings.graceDays);
    } else if (now.getTime() >= subscription.graceEndsAt.getTime()) {
      currentPeriodEnd = addMonthsFrom(now, 1);
      graceEndsAt = addDays(currentPeriodEnd, settings.graceDays);
    } else if (now.getTime() >= subscription.currentPeriodEnd.getTime()) {
      status = "GRACE";
    }
    await prisma.$transaction([
      prisma.client.update({ where: { id }, data: { status } }),
      prisma.subscription.update({
        where: { clientId: id },
        data: { status, currentPeriodEnd, graceEndsAt },
      }),
    ]);
    await audit(admin.sub, "client.reactivate", status, id);
    return { ok: true, status };
  });

  app.post("/admin/clients/:id/cancel", async (request, reply) => {
    const admin = await adminOf(request, reply);
    if (!admin) return;
    const { id } = request.params as { id: string };
    await prisma.$transaction([
      prisma.client.update({ where: { id }, data: { status: "CANCELLED" } }),
      prisma.subscription.update({ where: { clientId: id }, data: { status: "CANCELLED" } }),
    ]);
    await audit(admin.sub, "client.cancel", id, id);
    return { ok: true };
  });

  app.post("/admin/clients/:id/extend-trial", async (request, reply) => {
    const admin = await adminOf(request, reply);
    if (!admin) return;
    const { id } = request.params as { id: string };
    const body = z.object({ trialEndsAt: z.string().datetime() }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Choose a trial end date." });
    const settings = await readSettings();
    const trialEndsAt = new Date(body.data.trialEndsAt);
    const graceEndsAt = addDays(trialEndsAt, settings.graceDays);
    await prisma.$transaction([
      prisma.client.update({ where: { id }, data: { status: "TRIAL" } }),
      prisma.subscription.update({
        where: { clientId: id },
        data: { status: "TRIAL", trialEndsAt, currentPeriodEnd: trialEndsAt, graceEndsAt },
      }),
    ]);
    await audit(admin.sub, "client.extendTrial", trialEndsAt.toISOString(), id);
    return { ok: true };
  });

  app.post("/admin/clients/:id/pay", async (request, reply) => {
    const admin = await adminOf(request, reply);
    if (!admin) return;
    const { id } = request.params as { id: string };
    const body = z
      .object({
        amountPence: z.number().int().positive(),
        method: z.enum(["BANK_TRANSFER", "CASH", "CARD", "OTHER"]),
        reference: z.string().max(120).optional(),
        periodEnd: z.string().datetime().optional(),
      })
      .safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Check the payment and try again." });
    await markPaid({
      clientId: id,
      amountPence: body.data.amountPence,
      method: body.data.method,
      reference: body.data.reference ?? "",
      periodEnd: body.data.periodEnd ? new Date(body.data.periodEnd) : null,
      paidAt: new Date(),
      actorId: admin.sub,
    });
    return { ok: true };
  });

  app.post("/admin/clients/:id/password", async (request, reply) => {
    const admin = await adminOf(request, reply);
    if (!admin) return;
    const { id } = request.params as { id: string };
    const password = (await import("./passwords.js")).randomPassword();
    const client = await prisma.client.findUniqueOrThrow({ where: { id }, include: clientInclude });
    await prisma.clientAccount.update({
      where: { clientId: id },
      data: { passwordHash: await hashPassword(password) },
    });
    const settings = await readSettings();
    await audit(admin.sub, "client.resetPassword", client.clientCode, id);
    return {
      password,
      message: welcome({
        clientCode: client.clientCode,
        username: client.account?.username ?? "",
        password,
        downloadUrl: settings.downloadUrl,
      }),
    };
  });

  app.post("/admin/clients/:id/devices/:deviceId/block", async (request, reply) => {
    const admin = await adminOf(request, reply);
    if (!admin) return;
    const { id, deviceId } = request.params as { id: string; deviceId: string };
    await prisma.device.update({ where: { id: deviceId }, data: { status: "BLOCKED" } });
    await audit(admin.sub, "device.block", deviceId, id);
    return { ok: true };
  });

  app.delete("/admin/clients/:id/devices/:deviceId", async (request, reply) => {
    const admin = await adminOf(request, reply);
    if (!admin) return;
    const { id, deviceId } = request.params as { id: string; deviceId: string };
    await prisma.device.delete({ where: { id: deviceId } });
    await audit(admin.sub, "device.remove", deviceId, id);
    return { ok: true };
  });

  app.post("/admin/clients/:id/devices/max", async (request, reply) => {
    const admin = await adminOf(request, reply);
    if (!admin) return;
    const { id } = request.params as { id: string };
    const body = z.object({ maxDevices: z.number().int().min(1).max(50) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Enter a device limit of at least 1." });
    await prisma.subscription.update({ where: { clientId: id }, data: { maxDevices: body.data.maxDevices } });
    await audit(admin.sub, "device.max", String(body.data.maxDevices), id);
    return { ok: true };
  });

  app.get("/admin/payments", async (request, reply) => {
    const admin = await adminOf(request, reply);
    if (!admin) return;
    await refreshStatuses();
    const payments = await prisma.payment.findMany({
      include: { client: true },
      orderBy: { paidAt: "desc" },
    });
    const overdue = await prisma.client.findMany({
      where: { subscription: { status: { in: ["GRACE", "SUSPENDED", "EXPIRED"] } } },
      include: clientInclude,
    });
    return {
      payments: payments.map((payment) => ({
        id: payment.id,
        clientCode: payment.client.clientCode,
        businessName: payment.client.businessName,
        amountPence: payment.amountPence,
        amount: formatGbp(payment.amountPence),
        method: payment.method,
        reference: payment.reference,
        paidAt: payment.paidAt.toISOString(),
        periodStart: payment.periodStart.toISOString(),
        periodEnd: payment.periodEnd.toISOString(),
      })),
      overdue: overdue.map(clientJson),
    };
  });

  app.get("/admin/settings", async (request, reply) => {
    const admin = await adminOf(request, reply);
    if (!admin) return;
    return readSettings();
  });

  app.put("/admin/settings", async (request, reply) => {
    const admin = await adminOf(request, reply);
    if (!admin) return;
    const body = z
      .object({
        trialDays: z.number().int().positive().max(90),
        graceDays: z.number().int().positive().max(30),
        offlineHours: z.number().int().positive().max(24 * 14),
        defaultPricePence: z.number().int().positive(),
        latestVersion: z.string().min(1).max(40),
        downloadUrl: z.string().max(400),
      })
      .safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Check the settings and try again." });
    await writeSettings(body.data satisfies ShopLicenceSettings);
    await audit(admin.sub, "settings.update", body.data.latestVersion);
    return body.data;
  });

  app.post("/admin/users", async (request, reply) => {
    const admin = await adminOf(request, reply);
    if (!admin) return;
    if (admin.role !== "SuperAdmin") return reply.code(403).send({ error: "Only a super admin can add dashboard users." });
    const body = z
      .object({
        email: emailField,
        password: z.string().min(12).max(200),
        role: z.enum(["SuperAdmin", "Support"]),
      })
      .safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Use a valid email and a password of at least 12 characters." });
    await prisma.adminUser.create({
      data: {
        email: body.data.email.toLowerCase(),
        passwordHash: await hashPassword(body.data.password),
        role: body.data.role === "Support" ? "SUPPORT" : "SUPER_ADMIN",
      },
    });
    await audit(admin.sub, "admin.create", body.data.email.toLowerCase());
    return { ok: true };
  });

  app.post("/license/activate", loginLimit, async (request, reply) => {
    const body = z
      .object({
        username: z.string().min(1).max(80),
        password: z.string().min(1).max(200),
        deviceId: z.string().min(16).max(128),
        deviceName: z.string().min(1).max(120),
        appVersion: z.string().max(40),
      })
      .safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Enter the shop username and password." });
    await refreshStatuses();
    const account = await prisma.clientAccount.findUnique({
      where: { username: body.data.username },
      include: { client: { include: clientInclude } },
    });
    const valid = account ? await verifyPassword(account.passwordHash, body.data.password) : false;
    if (!account || !valid) return reply.code(401).send({ error: "Sign-in failed." });
    const client = account.client;
    const subscription = client.subscription;
    if (!subscription) return reply.code(403).send({ error: "Subscription inactive. Please contact your provider to restore access." });
    if (subscription.status === "SUSPENDED" || subscription.status === "CANCELLED" || subscription.status === "EXPIRED") {
      return reply.code(403).send({ error: "Subscription inactive. Please contact your provider to restore access." });
    }
    const existing = client.devices.find((device) => device.deviceId === body.data.deviceId);
    if (existing?.status === "BLOCKED") {
      return reply.code(403).send({ error: "This device is blocked. Contact your provider." });
    }
    const activeDevices = client.devices.filter((device) => device.status === "ACTIVE").length;
    if (!existing && activeDevices >= subscription.maxDevices) {
      return reply.code(403).send({ error: "This account has no free device slots. Contact your provider." });
    }
    const now = new Date();
    await prisma.device.upsert({
      where: { clientId_deviceId: { clientId: client.id, deviceId: body.data.deviceId } },
      create: {
        clientId: client.id,
        deviceId: body.data.deviceId,
        name: body.data.deviceName,
        lastIp: request.ip,
        appVersion: body.data.appVersion,
        status: "ACTIVE",
      },
      update: {
        name: body.data.deviceName,
        lastSeenAt: now,
        lastIp: request.ip,
        appVersion: body.data.appVersion,
        status: "ACTIVE",
      },
    });
    const token = await issueForDevice(client, { deviceId: body.data.deviceId, blocked: false });
    await audit("license", "device.activate", body.data.deviceId, client.id);
    return { token };
  });

  app.post("/license/check", async (request, reply) => {
    const body = z
      .object({
        clientCode: z.string().min(1),
        deviceId: z.string().min(16).max(128),
        appVersion: z.string().max(40).optional(),
      })
      .safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Licence check was rejected." });
    await refreshStatuses();
    const client = await prisma.client.findUnique({
      where: { clientCode: body.data.clientCode },
      include: clientInclude,
    });
    if (!client?.subscription) return reply.code(403).send({ error: "Subscription inactive. Please contact your provider to restore access." });
    const device = client.devices.find((item) => item.deviceId === body.data.deviceId);
    if (!device) {
      const token = await issueForDevice(client, { deviceId: body.data.deviceId, blocked: true });
      return { token };
    }
    if (device.status !== "BLOCKED") {
      await prisma.device.update({
        where: { id: device.id },
        data: {
          lastSeenAt: new Date(),
          lastIp: request.ip,
          appVersion: body.data.appVersion ?? device.appVersion,
        },
      });
    }
    const fresh = await prisma.client.findUniqueOrThrow({ where: { id: client.id }, include: clientInclude });
    const token = await issueForDevice(fresh, { deviceId: device.deviceId, blocked: device.status === "BLOCKED" });
    return { token };
  });

  app.post("/sync/heartbeat", async (request, reply) => {
    const body = z.object({ clientCode: z.string(), deviceId: z.string() }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Heartbeat was rejected." });
    const digest = createHash("sha256").update(body.data.deviceId).digest("hex").slice(0, 12);
    return { ok: true, serverTime: new Date().toISOString(), device: digest };
  });
}

function addMonthsFrom(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  const day = next.getUTCDate();
  next.setUTCMonth(next.getUTCMonth() + months);
  if (next.getUTCDate() < day) next.setUTCDate(0);
  return next;
}
