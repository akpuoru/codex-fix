import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { LoaderCircle, MessageSquareText, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSupportConversation, replySupportConversation } from "@/lib/support.functions";

type ConversationRow = {
  request_id: string;
  name: string;
  topic: string;
  tracking_number: string | null;
  status: string;
  request_created_at: string;
  sender_type: string | null;
  message: string | null;
  message_created_at: string | null;
};

export function SupportConversationLookup() {
  const lookup = useServerFn(getSupportConversation);
  const sendReply = useServerFn(replySupportConversation);
  const [reference, setReference] = useState("");
  const [rows, setRows] = useState<ConversationRow[] | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function loadConversation(nextReference = reference) {
    setPending(true);
    setError("");
    try {
      const result = await lookup({ data: { reference: nextReference.trim() } });
      setRows(result as ConversationRow[]);
      setReference(nextReference.trim());
    } catch (err) {
      setRows(null);
      setError(err instanceof Error ? err.message : "Unable to load this conversation.");
    } finally {
      setPending(false);
    }
  }

  async function handleReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await sendReply({ data: { reference: reference.trim(), message: draft.trim() } });
      setDraft("");
      await loadConversation(reference.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your reply could not be sent.");
    } finally {
      setPending(false);
    }
  }

  const request = rows?.[0];
  const messages = (rows ?? []).filter((row) => row.message && row.message_created_at);

  return <section className="rounded-lg border border-line bg-card p-5 sm:p-6">
    <div className="flex items-start gap-3">
      <MessageSquareText className="mt-1 size-5 shrink-0 text-primary" />
      <div><h3 className="font-display text-lg font-bold">Continue a support conversation</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Enter the full private reference shown after you sent your message. Keep it safe: anyone with the reference can open and reply to that conversation.</p></div>
    </div>

    <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void loadConversation(); }}>
      <label className="sr-only" htmlFor="support-reference">Private support reference</label>
      <input id="support-reference" name="support-reference" value={reference} onChange={(event) => setReference(event.target.value)} required placeholder="Paste the full support reference" autoComplete="off" className="min-w-0 flex-1 rounded-md border border-line bg-background px-3 py-2.5 font-mono text-sm outline-none focus:ring-2 focus:ring-primary" />
      <Button type="submit" disabled={pending}>{pending && !rows ? <LoaderCircle className="animate-spin" /> : null}Open conversation</Button>
    </form>

    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}

    {request && <div className="mt-6 border-t border-line pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{request.name} · {request.topic}</p><p className="mt-1 text-xs text-muted-foreground">Reference {request.request_id} · {request.status}{request.tracking_number ? ` · ${request.tracking_number}` : ""}</p></div></div>
      <div className="mt-4 space-y-3">{messages.map((row, index) => <article key={`${row.request_id}-${row.message_created_at}-${index}`} className={`rounded-md p-4 ${row.sender_type === "staff" ? "bg-secondary text-secondary-foreground" : "bg-muted/50"}`}>
        <div className="flex flex-wrap justify-between gap-2 text-xs font-semibold"><span>{row.sender_type === "staff" ? "Bridgeway support" : "You"}</span><time className="font-normal opacity-70">{new Date(row.message_created_at!).toLocaleString("en-GB")}</time></div>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{row.message}</p>
      </article>)}</div>
      <form className="mt-4 grid gap-3" onSubmit={handleReply}>
        <label htmlFor="support-reply" className="text-sm font-semibold">Your reply<textarea id="support-reply" name="support-reply" value={draft} onChange={(event) => setDraft(event.target.value)} required maxLength={3000} rows={3} className="mt-2 block w-full resize-y rounded-md border border-line bg-background px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
        <Button type="submit" disabled={pending || !draft.trim()} className="gap-2 sm:justify-self-start"><Send className="size-4" />Send reply</Button>
      </form>
    </div>}
  </section>;
}
