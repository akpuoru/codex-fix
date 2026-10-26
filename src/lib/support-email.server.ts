type SupportReplyEmail = {
  to: string;
  name: string;
  reference: string;
  message: string;
  idempotencyKey?: string;
};

type SupportReplyEmailResult = {
  sent: boolean;
  issue?: "not_configured" | "provider_error";
};

export async function sendSupportReplyEmail({
  to,
  name,
  reference,
  message,
  idempotencyKey,
}: SupportReplyEmail): Promise<SupportReplyEmailResult> {
  const apiKey = typeof process !== "undefined" ? process.env.RESEND_API_KEY : undefined;
  const from = typeof process !== "undefined" ? process.env.SUPPORT_EMAIL_FROM : undefined;
  const replyTo = typeof process !== "undefined" ? process.env.SUPPORT_EMAIL_REPLY_TO : undefined;

  if (!apiKey || !from) {
    const missing = [!apiKey && "RESEND_API_KEY", !from && "SUPPORT_EMAIL_FROM"].filter(Boolean);
    console.error(`[Support email] Missing server configuration: ${missing.join(", ")}.`);
    return { sent: false, issue: "not_configured" };
  }

  const text = [
    `Hello ${name.trim() || "there"},`,
    "",
    "Bridgeway support sent you a private email about your request:",
    "",
    message.trim(),
    "",
    "View the conversation and any attached photos at https://bridgewaytrack.live/contact.",
    `Enter your private support reference: ${reference}`,
  ].join("\n");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": `support-reply-${idempotencyKey}` } : {}),
      },
      body: JSON.stringify({
        from,
        to,
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject: `Bridgeway support replied · ${reference}`,
        text,
      }),
    });

    if (!response.ok) {
      console.error(`[Support email] Resend returned HTTP ${response.status}.`);
      return { sent: false, issue: "provider_error" };
    }

    return { sent: true };
  } catch (error) {
    console.error("[Support email] Resend request failed.", error instanceof Error ? error.message : error);
    return { sent: false, issue: "provider_error" };
  }
}
