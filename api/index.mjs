let app;

export default async function handler(request, response) {
  if (!app) {
    const loaded = await import("../apps/api/dist/app.js");
    app = await loaded.createApp();
  }
  await app.ready();
  app.server.emit("request", request, response);
}
