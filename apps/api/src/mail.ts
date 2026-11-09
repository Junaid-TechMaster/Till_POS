import { env } from "./env.js";

export async function sendEmail(input: { to: string; subject: string; text: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!env.resendApiKey || !env.emailFrom) {
    return { ok: false, error: "Day-end email is not set up on the server yet." };
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.emailFrom,
      to: [input.to],
      subject: input.subject,
      text: input.text,
    }),
  });
  if (!response.ok) return { ok: false, error: "The report could not be emailed." };
  return { ok: true };
}
