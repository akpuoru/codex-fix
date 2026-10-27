import { MessageCircle, Send } from "lucide-react";

const whatsappContact = import.meta.env["VITE_SUPPORT_WHATSAPP_NUMBER"]?.trim() || "+553173007351";
const whatsappNumber = whatsappContact.replace(/\D/g, "");
const telegramContact = import.meta.env["VITE_SUPPORT_TELEGRAM_URL"]?.trim() || "https://t.me/bridgewaytrack";

function getTelegramUrl(value: string): string | undefined {
  if (!value) return undefined;

  const candidate = value.startsWith("https://") ? value : `https://t.me/${value.replace(/^@/, "")}`;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" && (url.hostname === "t.me" || url.hostname === "telegram.me")
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

const telegramUrl = getTelegramUrl(telegramContact);

export function SupportChannels({ className = "" }: { className?: string }) {
  if (!whatsappNumber && !telegramUrl) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`} aria-label="Message Bridgeway support">
      {whatsappNumber && (
        <a
          href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hello Bridgeway Support, I need help.")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-line bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted"
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          WhatsApp support
        </a>
      )}
      {telegramUrl && (
        <a
          href={telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-line bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted"
        >
          <Send className="size-4" aria-hidden="true" />
          Telegram support
        </a>
      )}
    </div>
  );
}
