import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { LiveChatConversation } from "@/components/live-chat-conversation";

export function AdminLiveChats() {
  const { user } = useSession();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("open");
  const [error, setError] = useState("");
  const query = useQuery({ queryKey: ["live-chat-threads", user?.id], enabled: !!user, refetchInterval: 5000, queryFn: async () => {
    const { data, error } = await supabase.from("chat_threads").select("*").order("updated_at", { ascending: false }).limit(200);
    if (error) throw error;
    return data;
  } });
  useEffect(() => {
    const channel = supabase.channel("admin-live-chats").on("postgres_changes", { event: "*", schema: "public", table: "chat_threads" }, () => { void qc.invalidateQueries({ queryKey: ["live-chat-threads"] }); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [qc]);
  const thread = query.data?.find((t) => t.id === selected);
  return <section className="mb-10 border-b border-line pb-8">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-display text-xl"><MessageCircle className="size-5 text-primary" />Live chats</h2><select aria-label="Filter live chats" value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-md border border-line bg-card px-3 py-2 text-sm"><option value="open">Open conversations</option><option value="closed">Closed conversations</option><option value="all">All conversations</option></select></div>
    {query.isPending && <p className="text-sm text-muted-foreground">Loading live chats…</p>}
    {query.error && <p role="alert" className="text-sm text-destructive">Unable to load live chats.</p>}
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="space-y-2">{query.data?.filter((t) => filter === "all" || t.status === filter).map((t) => <Button key={t.id} variant={t.id === selected ? "secondary" : "outline"} className="h-auto w-full justify-start whitespace-normal px-4 py-3 text-left" onClick={() => { setSelected(t.id); setError(""); }}><span className="min-w-0"><span className="block font-semibold">{t.customer_name}</span><span className="block break-all text-xs font-normal">{t.customer_email}</span><span className="mt-1 block text-[10px] font-normal">{t.status} · {new Date(t.updated_at).toLocaleString("en-GB")}</span></span></Button>)}{!query.isPending && query.data?.filter((t) => filter === "all" || t.status === filter).length === 0 && <p className="py-6 text-sm text-muted-foreground">No conversations here yet.</p>}</div>
      <div>{thread ? <><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 className="font-sans font-semibold">{thread.customer_name}</h3><Button size="sm" variant="outline" onClick={async () => {
        const { error } = await supabase.from("chat_threads").update({ status: thread.status === "open" ? "closed" : "open" }).eq("id", thread.id);
        if (error) setError("Unable to update conversation."); else void qc.invalidateQueries({ queryKey: ["live-chat-threads"] });
      }}><X className="size-3" />{thread.status === "open" ? "Close conversation" : "Reopen conversation"}</Button></div><LiveChatConversation key={thread.id} threadId={thread.id} staff />{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</> : <p className="py-12 text-center text-sm text-muted-foreground">Select a conversation to reply.</p>}</div>
    </div>
  </section>;
}