import { randomBytes, randomInt } from "node:crypto";
import argon2 from "argon2";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export function randomPassword(length = 20): string {
  return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join("");
}

export function randomUsername(businessName: string): string {
  const slug = businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 18) || "shop";
  const suffix = randomBytes(2).toString("hex");
  return `${slug}-${suffix}`;
}
