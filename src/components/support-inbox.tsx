import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Check, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listSupport, resolveSupport } from "@/lib/support.functions";
import { useSession } from "@/hooks/use-session";
import { AdminLiveChats } from "@/components/admin-live-chats";

export function SupportInbox() {
  const list = useServerFn(listSupport);
  const resolve = useServerFn(resolveSupport);
  const { user } = useSession();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("new");
  const query = useQuery({ queryKey: ["support-inbox", user?.id], queryFn: () => list(), enabled: !!user, refetchInterval: 30000 });
  const mutation = useMutation({ mutationFn: (data: { id: string; status: "new" | "resolved" }) => resolve({ data }), onSuccess: () => qc.invalidateQueries({ queryKey: ["support-inbox"] }), onError: () => toast.error("Unable to update this request.") });
  const rows = (query.data ?? []).filter((row) => filter === "all" || row.status === filter);
  return <section className="mt-6">
    <AdminLiveChats />
    <div className="flex items-center justify-between gap-3"><h2 className="font-display text-xl">Customer messages</h2><select aria-label="Filter messages" className="rounded-md border border-line bg-card px-3 py-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="new">New</option><option value="resolved">Resolved</option><option value="all">All messages</option></select></div>
    {query.isPending && <p className="py-8 text-muted-foreground">Loading messages…</p>}
    {query.error && <p role="alert" className="py-8 text-destructive">Unable to load messages.</p>}
    {!query.isPending && !query.error && !rows.length && <div className="py-16 text-center text-muted-foreground"><Inbox className="mx-auto mb-3 size-8" />No messages here.</div>}
    <div className="mt-5 grid gap-4">{rows.map((row) => <article key={row.id} className="rounded-md border border-line bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-sans text-base font-semibold">{row.name}</h3><div className="mt-1 text-sm text-muted-foreground">{row.email}</div></div><span className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString("en-GB")} · {row.channel} · {row.status}</span></div>
      <div className="mt-3 text-xs font-semibold uppercase text-primary">{row.topic} {row.tracking_number && `· ${row.tracking_number}`}</div>
      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{row.message}</p>
      <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" asChild><a href={`mailto:${encodeURIComponent(row.email)}?subject=${encodeURIComponent(`Bridgeway support · ${row.id.slice(0,8).toUpperCase()}`)}`}><Mail className="size-4" />Reply by email</a></Button><Button variant="ghost" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: row.id, status: row.status === "new" ? "resolved" : "new" })}><Check className="size-4" />{row.status === "new" ? "Mark resolved" : "Reopen"}</Button></div>
    </article>)}</div>
  </section>;
}