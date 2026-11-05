import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { env } from "./env.js";
import { registerRoutes } from "./http.js";
import { refreshStatuses } from "./licensing.js";

const app = Fastify({ logger: true, trustProxy: true });

await app.register(helmet);
await app.register(cors, { origin: env.adminOrigin.split(",").map((origin) => origin.trim()) });
await app.register(rateLimit, { global: false });

app.addHook("onRequest", async (request, reply) => {
  if (env.nodeEnv !== "production") return;
  if (request.url.startsWith("/health")) return;
  const host = request.hostname;
  if (host === "localhost" || host === "127.0.0.1") return;
  if (request.headers["x-forwarded-proto"] !== "https") {
    return reply.code(400).send({ error: "HTTPS is required." });
  }
});

await registerRoutes(app);

const timer = setInterval(() => {
  void refreshStatuses().catch((error: unknown) => {
    app.log.error(error);
  });
}, 60_000);
timer.unref();

await refreshStatuses();

await app.listen({ port: env.port, host: "0.0.0.0" });
