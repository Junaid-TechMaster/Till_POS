import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const dataDir = resolve("data/pg");
mkdirSync(dataDir, { recursive: true });

const postgres = new EmbeddedPostgres({
  databaseDir: dataDir,
  port: 5432,
  user: "tillpro",
  password: "tillpro",
  persistent: true,
  autoRehydrateSymlinks: true,
});

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: true });
    child.on("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function main(): Promise<void> {
  if (!existsSync(join(dataDir, "PG_VERSION"))) {
    await postgres.initialise();
    console.log("Created the local PostgreSQL cluster.");
  }
  await postgres.start();
  console.log("PostgreSQL is listening on port 5432.");
  try {
    await postgres.createDatabase("tillpro");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists/i.test(message)) throw error;
  }
  await run("npx", ["prisma", "migrate", "deploy"]);
  await run("npx", ["tsx", "prisma/seed.ts"]);
  await import("../src/index.ts");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
