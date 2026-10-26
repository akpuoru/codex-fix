import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Check, Inbox, Send, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { adminDeleteSupportConversation, adminDeleteSupportMessage, adminReplySupportConversation, listSupport, resolveSupport } from "@/lib/support.functions";
import { removeSupportPhotos, SupportPhotoGallery, SupportPhotoPicker, uploadSupportPhotos } from "@/components/support-photo-tools";
import { useSession } from "@/hooks/use-session";
import { AdminLiveChats } from "@/components/admin-live-chats";

export function SupportInbox() {
  const list = useServerFn(listSupport);
  const resolve = useServerFn(resolveSupport);
  const reply = useServerFn(adminReplySupportConversation);
  const deleteConversation = useServerFn(adminDeleteSupportConversation);
  const deleteMessage = useServerFn(adminDeleteSupportMessage);
  const { user } = useSession();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("new");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [emailDrafts, setEmailDrafts] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<string, File[]>>({});
  const query = useQuery({ queryKey: ["support-inbox", user?.id], queryFn: () => list(), enabled: !!user, refetchInterval: 30000 });
  const mutation = useMutation({ mutationFn: (data: { id: string; status: "new" | "resolved" }) => resolve({ data }), onSuccess: () => qc.invalidateQueries({ queryKey: ["support-inbox"] }), onError: () => toast.error("Unable to update this request.") });
  const replyMutation = useMutation({ mutationFn: async (data: { id: string; reference: string; message: string; files: File[] }) => {
    const attachments = await uploadSupportPhotos(data.reference, data.files);
    try {
      return await reply({ data: { id: data.id, message: data.message, attachments, action: "site" } });
    } catch (error) {
      await removeSupportPhotos(attachments);
      throw error;
    }
  }, onSuccess: (_result, data) => {
    setDrafts((current) => ({ ...current, [data.id]: "" }));
    setPhotos((current) => ({ ...current, [data.id]: [] }));
    void qc.invalidateQueries({ queryKey: ["support-inbox"] });
    toast.success("Reply posted to the support conversation.");
  }, onError: () => toast.error("Unable to post this reply.") });
  const emailMutation = useMutation({ mutationFn: (data: { id: string; message: string }) => reply({ data: { ...data, attachments: [], action: "email" } }), onSuccess: (result, data) => {
    if (result.action === "email" && result.emailSent) {
      setEmailDrafts((current) => ({ ...current, [data.id]: "" }));
      toast.success("Email sent. It was not added to the support conversation.");
    } else if (result.action === "email" && result.emailIssue === "not_configured") {
      toast.error("Email is not configured. Add RESEND_API_KEY and SUPPORT_EMAIL_FROM in Cloudflare.");
    } else {
      toast.error("Email could not be sent. It was not added to the support conversation.");
    }
  }, onError: () => toast.error("Unable to email this customer.") });
  const deleteMessageMutation = useMutation({ mutationFn: async (id: string) => {
    const result = await deleteMessage({ data: { id } });
    let photosRemoved = true;
    try { await removeSupportPhotos(result.attachments); } catch { photosRemoved = false; }
    return { photosRemoved };
  }, onSuccess: ({ photosRemoved }) => {
    void qc.invalidateQueries({ queryKey: ["support-inbox"] });
    if (photosRemoved) toast.success("Message deleted from the support conversation.");
    else toast.error("Message deleted, but its photos could not be removed.");
  }, onError: () => toast.error("Unable to delete this support message.") });
  const deleteConversationMutation = useMutation({ mutationFn: async (id: string) => {
    const result = await deleteConversation({ data: { id } });
    let photosRemoved = true;
    try { await removeSupportPhotos(result.attachments); } catch { photosRemoved = false; }
    return { photosRemoved };
  }, onSuccess: ({ photosRemoved }) => {
    void qc.invalidateQueries({ queryKey: ["support-inbox"] });
    if (photosRemoved) toast.success("Support conversation deleted.");
    else toast.error("Support conversation deleted, but some photos could not be removed.");
  }, onError: () => toast.error("Unable to delete this support conversation.") });
  const rows = (query.data ?? []).filter((row) => filter === "all" || row.status === filter);
  return <section className="mt-6">
    <AdminLiveChats />
    <div className="flex items-center justify-between gap-3"><h2 className="font-display text-xl">Customer messages</h2><select aria-label="Filter messages" className="rounded-md border border-line bg-card px-3 py-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="new">New</option><option value="resolved">Resolved</option><option value="all">All messages</option></select></div>
    {query.isPending && <p className="py-8 text-muted-foreground">Loading messages…</p>}
    {query.error && <p role="alert" className="py-8 text-destructive">Unable to load messages.</p>}
    {!query.isPending && !query.error && !rows.length && <div className="py-16 text-center text-muted-foreground"><Inbox className="mx-auto mb-3 size-8" />No messages here.</div>}
    <div className="mt-5 grid gap-4">{rows.map((row) => <article key={row.id} className="rounded-md border border-line bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-sans text-base font-semibold">{row.name}</h3><div className="mt-1 text-sm text-muted-foreground">{row.email}</div></div><div className="flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString("en-GB")} · {row.channel} · {row.status}</span><Button type="button" size="sm" variant="destructive" disabled={deleteConversationMutation.isPending} onClick={() => { if (window.confirm(`Permanently delete the support conversation from ${row.name}? All messages and photos will be removed.`)) deleteConversationMutation.mutate(row.id); }}><Trash2 className="size-3" />Delete conversation</Button></div></div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase text-primary">{row.topic} {row.tracking_number && `· ${row.tracking_number}`}<span className="font-normal normal-case text-muted-foreground">· Case reference {row.public_reference}</span><Button type="button" size="sm" variant="ghost" className="h-7 px-2" aria-label="Copy support reference" onClick={async () => { try { await navigator.clipboard.writeText(row.public_reference); toast.success("Support reference copied."); } catch { toast.error("Could not copy the reference."); } }}><Copy className="size-3" />Copy reference</Button></div>
      <div className="mt-4 space-y-3">{row.messages.map((message) => <article key={message.id} className={`rounded-md p-4 ${message.sender_type === "staff" ? "bg-secondary text-secondary-foreground" : "bg-muted/50"}`}><div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold"><div className="flex flex-wrap items-center gap-2"><span>{message.sender_type === "staff" ? "Bridgeway support" : "Customer"}</span><time className="font-normal opacity-70">{new Date(message.created_at).toLocaleString("en-GB")}</time></div><Button type="button" size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-destructive" aria-label="Delete this message" title="Delete this message" disabled={deleteMessageMutation.isPending} onClick={() => { if (window.confirm("Permanently delete this message from the support conversation?")) deleteMessageMutation.mutate(message.id); }}><Trash2 className="size-3.5" /></Button></div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{message.message}</p><SupportPhotoGallery paths={message.attachments ?? []} /></article>)}</div>
      <form className="mt-4 grid gap-3" onSubmit={(event) => { event.preventDefault(); const message = (drafts[row.id] ?? "").trim(); if (message) replyMutation.mutate({ id: row.id, reference: row.public_reference, message, files: photos[row.id] ?? [] }); }}>
        <label htmlFor={`support-reply-${row.id}`} className="text-sm font-semibold">Post reply on support site<textarea id={`support-reply-${row.id}`} name={`support-reply-${row.id}`} value={drafts[row.id] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [row.id]: event.target.value }))} required maxLength={3000} rows={3} className="mt-2 block w-full resize-y rounded-md border border-line bg-background px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
        <SupportPhotoPicker files={photos[row.id] ?? []} onChange={(files) => setPhotos((current) => ({ ...current, [row.id]: files }))} disabled={replyMutation.isPending} />
        <Button type="submit" className="w-fit" disabled={replyMutation.isPending || !(drafts[row.id] ?? "").trim()}><Send className="size-4" />Post reply on site</Button>
      </form>
      <form className="mt-4 grid gap-3 border-t border-line pt-4" onSubmit={(event) => { event.preventDefault(); const message = (emailDrafts[row.id] ?? "").trim(); if (message) emailMutation.mutate({ id: row.id, message }); }}>
        <label htmlFor={`support-email-${row.id}`} className="text-sm font-semibold">Email customer privately<textarea id={`support-email-${row.id}`} name={`support-email-${row.id}`} value={emailDrafts[row.id] ?? ""} onChange={(event) => setEmailDrafts((current) => ({ ...current, [row.id]: event.target.value }))} required maxLength={3000} rows={3} className="mt-2 block w-full resize-y rounded-md border border-line bg-background px-3 py-2.5 text-sm font-normal outline-none focus:ring-2 focus:ring-primary" /></label>
        <p className="text-xs text-muted-foreground">Sent to {row.email}. This email will not appear in the support conversation.</p>
        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={emailMutation.isPending || !(emailDrafts[row.id] ?? "").trim()}><Mail className="size-4" />Send email only</Button><Button variant="outline" asChild><a href={`mailto:${encodeURIComponent(row.email)}?subject=${encodeURIComponent(`Bridgeway support · ${row.public_reference}`)}`}><Mail className="size-4" />Open email app</a></Button><Button type="button" variant="ghost" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: row.id, status: row.status === "new" ? "resolved" : "new" })}><Check className="size-4" />{row.status === "new" ? "Mark resolved" : "Reopen"}</Button></div>
      </form>
    </article>)}</div>
  </section>;
}
