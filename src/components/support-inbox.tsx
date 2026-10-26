import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Check, Inbox, Send, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminReplySupportConversation, listSupport, resolveSupport } from "@/lib/support.functions";
import { removeSupportPhotos, SupportPhotoGallery, SupportPhotoPicker, uploadSupportPhotos } from "@/components/support-photo-tools";
import { useSession } from "@/hooks/use-session";
import { AdminLiveChats } from "@/components/admin-live-chats";

export function SupportInbox() {
  const list = useServerFn(listSupport);
  const resolve = useServerFn(resolveSupport);
  const reply = useServerFn(adminReplySupportConversation);
  const { user } = useSession();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("new");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<string, File[]>>({});
  const query = useQuery({ queryKey: ["support-inbox", user?.id], queryFn: () => list(), enabled: !!user, refetchInterval: 30000 });
  const mutation = useMutation({ mutationFn: (data: { id: string; status: "new" | "resolved" }) => resolve({ data }), onSuccess: () => qc.invalidateQueries({ queryKey: ["support-inbox"] }), onError: () => toast.error("Unable to update this request.") });
  const replyMutation = useMutation({ mutationFn: async (data: { id: string; reference: string; message: string; files: File[] }) => {
    const attachments = await uploadSupportPhotos(data.reference, data.files);
    try {
      return await reply({ data: { id: data.id, message: data.message, attachments } });
    } catch (error) {
      await removeSupportPhotos(attachments);
      throw error;
    }
  }, onSuccess: (result, data) => {
    setDrafts((current) => ({ ...current, [data.id]: "" }));
    setPhotos((current) => ({ ...current, [data.id]: [] }));
    void qc.invalidateQueries({ queryKey: ["support-inbox"] });
    if (result.emailSent) {
      toast.success("Reply added and customer email queued.");
    } else if (result.emailIssue === "not_configured") {
      toast.error("Reply saved, but email is not configured. Add RESEND_API_KEY and SUPPORT_EMAIL_FROM in Cloudflare.");
    } else {
      toast.error("Reply saved, but the email could not be sent. Use “Reply by email” to contact the customer.");
    }
  }, onError: () => toast.error("Unable to send this reply.") });
  const rows = (query.data ?? []).filter((row) => filter === "all" || row.status === filter);
  return <section className="mt-6">
    <AdminLiveChats />
    <div className="flex items-center justify-between gap-3"><h2 className="font-display text-xl">Customer messages</h2><select aria-label="Filter messages" className="rounded-md border border-line bg-card px-3 py-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="new">New</option><option value="resolved">Resolved</option><option value="all">All messages</option></select></div>
    {query.isPending && <p className="py-8 text-muted-foreground">Loading messages…</p>}
    {query.error && <p role="alert" className="py-8 text-destructive">Unable to load messages.</p>}
    {!query.isPending && !query.error && !rows.length && <div className="py-16 text-center text-muted-foreground"><Inbox className="mx-auto mb-3 size-8" />No messages here.</div>}
    <div className="mt-5 grid gap-4">{rows.map((row) => <article key={row.id} className="rounded-md border border-line bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-sans text-base font-semibold">{row.name}</h3><div className="mt-1 text-sm text-muted-foreground">{row.email}</div></div><span className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString("en-GB")} · {row.channel} · {row.status}</span></div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase text-primary">{row.topic} {row.tracking_number && `· ${row.tracking_number}`}<span className="font-normal normal-case text-muted-foreground">· Case reference {row.public_reference}</span><Button type="button" size="sm" variant="ghost" className="h-7 px-2" aria-label="Copy support reference" onClick={async () => { try { await navigator.clipboard.writeText(row.public_reference); toast.success("Support reference copied."); } catch { toast.error("Could not copy the reference."); } }}><Copy className="size-3" />Copy reference</Button></div>
      <div className="mt-4 space-y-3">{row.messages.map((message) => <article key={message.id} className={`rounded-md p-4 ${message.sender_type === "staff" ? "bg-secondary text-secondary-foreground" : "bg-muted/50"}`}><div className="flex flex-wrap justify-between gap-2 text-xs font-semibold"><span>{message.sender_type === "staff" ? "Bridgeway support" : "Customer"}</span><time className="font-normal opacity-70">{new Date(message.created_at).toLocaleString("en-GB")}</time></div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{message.message}</p><SupportPhotoGallery paths={message.attachments ?? []} /></article>)}</div>
      <form className="mt-4 grid gap-3" onSubmit={(event) => { event.preventDefault(); const message = (drafts[row.id] ?? "").trim(); if (message) replyMutation.mutate({ id: row.id, reference: row.public_reference, message, files: photos[row.id] ?? [] }); }}>
        <label htmlFor={`support-reply-${row.id}`} className="text-sm font-semibold">Reply in Bridgeway<textarea id={`support-reply-${row.id}`} name={`support-reply-${row.id}`} value={drafts[row.id] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [row.id]: event.target.value }))} required maxLength={3000} rows={3} className="mt-2 block w-full resize-y rounded-md border border-line bg-background px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
        <SupportPhotoPicker files={photos[row.id] ?? []} onChange={(files) => setPhotos((current) => ({ ...current, [row.id]: files }))} disabled={replyMutation.isPending} />
        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={replyMutation.isPending || !(drafts[row.id] ?? "").trim()}><Send className="size-4" />Send reply &amp; email customer</Button><Button variant="outline" asChild><a href={`mailto:${encodeURIComponent(row.email)}?subject=${encodeURIComponent(`Bridgeway support · ${row.public_reference}`)}`}><Mail className="size-4" />Reply by email</a></Button><Button type="button" variant="ghost" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: row.id, status: row.status === "new" ? "resolved" : "new" })}><Check className="size-4" />{row.status === "new" ? "Mark resolved" : "Reopen"}</Button></div>
      </form>
    </article>)}</div>
  </section>;
}
