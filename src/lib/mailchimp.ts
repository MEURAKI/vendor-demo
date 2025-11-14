export async function subscribeEmail(email: string) {
  try {
    const res = await fetch("/api/mailchimp/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: !!json?.ok };
  } catch {
    return { ok: false };
  }
}