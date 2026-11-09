import { cpSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const site = resolve(root, "apps/site/dist");
const admin = resolve(root, "apps/admin/dist");
const dashboard = resolve(site, "dashboard");
rmSync(dashboard, { recursive: true, force: true });
mkdirSync(dashboard, { recursive: true });
cpSync(admin, dashboard, { recursive: true });
console.log("Dashboard copied to apps/site/dist/dashboard");
