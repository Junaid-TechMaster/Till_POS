import { spawn } from "node:child_process";
import { createReadStream, readFileSync, statSync } from "node:fs";
import https from "node:https";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const repo = "Junaid-TechMaster/Till_POS";
const releases = JSON.parse(readFileSync(resolve(root, "apps/site/public/releases.json"), "utf8"));

function gitToken() {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("git", ["credential", "fill"], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.on("close", (code) => {
      const password = out.match(/^password=(.*)$/m)?.[1];
      if (code !== 0 || !password) {
        reject(new Error("GitHub sign-in was not available. Sign in to GitHub on this PC and run this again."));
        return;
      }
      resolvePromise(password);
    });
    child.stdin.end("protocol=https\nhost=github.com\n\n");
  });
}

function request(url, { method = "GET", token, headers = {}, body } = {}) {
  return new Promise((resolvePromise, reject) => {
    const target = new URL(url);
    const req = https.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        path: `${target.pathname}${target.search}`,
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "tillpro-release",
          "X-GitHub-Api-Version": "2022-11-28",
          ...headers,
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let parsed = {};
          try {
            parsed = text ? JSON.parse(text) : {};
          } catch {
            parsed = { message: text.slice(0, 180) };
          }
          resolvePromise({ status: response.statusCode ?? 0, body: parsed });
        });
      },
    );
    req.on("error", reject);
    if (!body) req.end();
    else if (typeof body === "string") req.end(body);
    else body.pipe(req);
  });
}

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || (await gitToken());

for (const item of releases.versions) {
  const file = resolve(root, "apps/till-desktop/release", item.file);
  const size = statSync(file).size;
  const tag = `v${item.version}`;
  let lookup = await request(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, { token });
  if (lookup.status === 404) {
    const payload = JSON.stringify({
      tag_name: tag,
      name: `TillPro ${item.version}`,
      body: item.notes,
      target_commitish: "cursor/separate-shop-data-and-day-end",
    });
    lookup = await request(`https://api.github.com/repos/${repo}/releases`, {
      method: "POST",
      token,
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
      body: payload,
    });
  }
  if (lookup.status < 200 || lookup.status >= 300 || !lookup.body.id) {
    console.log(`${tag} release failed (${lookup.status}) ${lookup.body.message ?? ""}`);
    process.exitCode = 1;
    continue;
  }
  const existing = (lookup.body.assets ?? []).find((asset) => asset.name === item.file);
  if (existing) {
    console.log(`${tag} already uploaded`);
    continue;
  }
  const uploaded = await request(
    `https://uploads.github.com/repos/${repo}/releases/${lookup.body.id}/assets?name=${encodeURIComponent(item.file)}`,
    {
      method: "POST",
      token,
      headers: { "Content-Type": "application/octet-stream", "Content-Length": String(size) },
      body: createReadStream(file),
    },
  );
  if (uploaded.status < 200 || uploaded.status >= 300) {
    console.log(`${tag} upload failed (${uploaded.status}) ${uploaded.body.message ?? ""}`);
    process.exitCode = 1;
    continue;
  }
  console.log(`${tag} uploaded`);
}
