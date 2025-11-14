import fs from "node:fs/promises";
import path from "node:path";
import mailchimp from "@mailchimp/mailchimp_transactional";

const mc = mailchimp(process.env.MAILCHIMP_TRANSACTIONAL_KEY!);
const FROM = process.env.EMAIL_FROM || "no-reply@meuraki.com.sg";
const FROM_NAME = process.env.EMAIL_FROM_NAME || "MEURAKI";

function fill(html: string, vars: Record<string,string>) {
  return html.replace(/{{\s*(\w+)\s*}}/g, (_, k) => vars[k] ?? "");
}

export async function sendResetEmail(to: string, userName: string, resetUrl: string) {
  const templatePath = path.join(process.cwd(), "emails", "reset.html");
  const raw = await fs.readFile(templatePath, "utf8");
  const html = fill(raw, { userName, resetUrl });

  return mc.messages.send({
    message: {
      from_email: FROM,
      from_name: FROM_NAME,
      to: [{ email: to, type: "to" }],
      subject: "Reset your MEURAKI password",
      html,
      text: `Hello ${userName}

We received a request to reset your password.
Reset your password: ${resetUrl}

If you didn’t request this, please ignore this email or contact support.`
    }
  });
}