import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, CheckCheck, MessageCircle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";

export function LiveChatConversation({ threadId, staff = false }: { threadId: string; staff?: boolean }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const key = ["chat-messages", user?.id, threadId];
  const query = useQuery({ queryKey: key, enabled: !!user, refetchInterval: 5000, queryFn: async () => {
    const { data, error } = await supabase.from("chat_messages").select("*").eq("thread_id", threadId).order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    return data.reverse();
  } });
  useEffect(() => {
    const channel = supabase.channel(`conversation-${threadId}-${staff}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${threadId}` }, () => {
      void qc.invalidateQueries({ queryKey: ["chat-messages", user?.id, threadId] });
    }).subscribe((status) => setConnected(status === "SUBSCRIBED"));
    return () => { void supabase.removeChannel(channel); };
  }, [threadId, user?.id, staff, qc]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [query.data?.length]);
  const mutation = useMutation({ mutationFn: async (body: string) => {
    const { error } = await supabase.rpc("send_live_message", { _thread: threadId, _body: body, _staff: staff });
    if (error) throw error;
  }, onSuccess: () => { setDraft(""); setError(""); void qc.invalidateQueries({ queryKey: key }); void qc.invalidateQueries({ queryKey: ["live-chat-threads"] }); }, onError: (err) => setError(err.message) });
  const deleteMutation = useMutation({ mutationFn: async (messageId: string) => {
    const { error } = await supabase.rpc("admin_delete_live_chat_message", { _message: messageId });
    if (error) throw error;
  }, onSuccess: () => { setError(""); void qc.invalidateQueries({ queryKey: key }); void qc.invalidateQueries({ queryKey: ["live-chat-threads"] }); }, onError: () => setError("Unable to delete this chat message.") });
  return <div className="flex min-h-0 flex-col">
    <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><span className={`size-2 rounded-full ${connected ? "bg-success" : "bg-caution"}`} />{connected ? "Live connection" : "Checking for updates…"}</div>
    <div role="log" aria-label="Chat messages" aria-live="polite" className="h-[min(42dvh,360px)] overflow-y-auto rounded-md border border-line bg-background p-4">
      {query.isPending && <p className="text-sm text-muted-foreground">Loading conversation…</p>}
      {query.error && <div role="alert"><p className="text-sm text-destructive">Unable to load this conversation.</p><Button variant="outline" onClick={() => query.refetch()}>Try again</Button></div>}
      {query.data?.length === 0 && <div className="py-8 text-center"><MessageCircle className="mx-auto size-8 text-primary" /><p className="mt-4 text-sm text-muted-foreground">Send a message to start your conversation with our team.</p></div>}
      {query.data?.map((message) => {
        const own = staff ? message.is_staff : !message.is_staff;
        return <div key={message.id} className={`mb-4 flex flex-col ${own ? "items-end" : "items-start"}`}>
          <span className="mb-1 text-[11px] text-muted-foreground">{message.is_staff ? "Bridgeway team" : staff ? "Customer" : "You"}</span>
          <div className="flex items-center gap-2">
            <div className={`max-w-[88%] whitespace-pre-wrap break-words rounded-md px-3 py-2 text-sm leading-6 ${own ? "bg-primary text-primary-foreground" : "border border-line bg-card text-card-foreground"}`}>{message.body}</div>
            {staff && <Button type="button" size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-destructive" aria-label="Delete this chat message" title="Delete this chat message" disabled={deleteMutation.isPending} onClick={() => { if (window.confirm("Permanently delete this message from the live chat?")) deleteMutation.mutate(message.id); }}><Trash2 className="size-3.5" /></Button>}
          </div>
          <span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">{new Date(message.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}{own && <CheckCheck className="size-3" aria-label="Sent" />}</span>
        </div>;
      })}<div ref={end} />
    </div>
    <form className="mt-3 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.trim() && !mutation.isPending) mutation.mutate(draft.trim()); }}>
      <textarea aria-label={staff ? "Reply to customer" : "Message to support"} value={draft} onChange={(e) => setDraft(e.target.value)} required maxLength={3000} rows={2} placeholder={staff ? "Write a reply…" : "How can we help?"} className="min-w-0 flex-1 resize-none rounded-md border border-line bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
      <Button type="submit" size="icon" aria-label={staff ? "Send reply" : "Send chat message"} disabled={mutation.isPending || !draft.trim()} className="size-10 shrink-0"><Send className="size-4" /></Button>
    </form>
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
  </div>;
}
