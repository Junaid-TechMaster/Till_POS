import { createApp } from "./app.js";
import { env } from "./env.js";
import { refreshStatuses } from "./licensing.js";

const app = await createApp();

if (!process.env.VERCEL) {
  const timer = setInterval(() => {
    void refreshStatuses().catch((error: unknown) => {
      app.log.error(error);
    });
  }, 60_000);
  timer.unref();
  await app.listen({ port: env.port, host: "0.0.0.0" });
}

export default app;
