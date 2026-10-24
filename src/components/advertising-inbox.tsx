import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Inbox, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import {
  listAdvertRequests,
  updateAdvertRequest,
  type AdvertRequestStatus,
} from "@/lib/advertising.functions";

const STATUSES: AdvertRequestStatus[] = ["new", "reviewing", "approved", "declined"];

export function AdvertisingInbox() {
  const list = useServerFn(listAdvertRequests);
  const update = useServerFn(updateAdvertRequest);
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<AdvertRequestStatus | "all">("new");
  const query = useQuery({
    queryKey: ["advert-requests", user?.id],
    queryFn: () => list(),
    enabled: !!user,
  });
  const mutation = useMutation({
    mutationFn: (data: { id: string; status: AdvertRequestStatus }) => update({ data }),
    onSuccess: () => {
      toast.success("Advertising request updated.");
      void queryClient.invalidateQueries({ queryKey: ["advert-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["active-advertisements"] });
    },
    onError: (error: Error) => toast.error(error.message || "Unable to update this request."),
  });

  const rows = (query.data ?? []).filter((row) => filter === "all" || row.status === filter);

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Brand campaign requests</h2>
          <p className="mt-1 text-sm text-muted-foreground">Approve a campaign to publish it in the homepage partner section during its scheduled dates.</p>
        </div>
        <select
          aria-label="Filter advertising requests"
          className="rounded-md border border-line bg-card px-3 py-2 text-sm"
          value={filter}
          onChange={(event) => setFilter(event.target.value as AdvertRequestStatus | "all")}
        >
          <option value="new">New</option>
          <option value="reviewing">Reviewing</option>
          <option value="approved">Approved</option>
          <option value="declined">Declined</option>
          <option value="all">All requests</option>
        </select>
      </div>

      {query.isPending && <p className="py-8 text-sm text-muted-foreground">Loading advertising requests…</p>}
      {query.error && <p role="alert" className="py-8 text-sm text-destructive">Unable to load advertising requests.</p>}
      {!query.isPending && !query.error && !rows.length && (
        <div className="py-16 text-center text-muted-foreground">
          <Inbox className="mx-auto mb-3 size-8" />
          No advertising requests in this view.
        </div>
      )}

      <div className="mt-5 grid gap-4">
        {rows.map((row) => (
          <article key={row.id} className="rounded-xl bg-card p-5 ring-1 ring-line">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-bold">{row.brand_name}</h3>
                <p className="text-sm text-muted-foreground">{row.contact_name} · {row.email}</p>
                {row.brand_url && <a className="mt-1 inline-block text-xs text-primary underline" href={row.brand_url} target="_blank" rel="noreferrer">Brand website</a>}
              </div>
              <span className="rounded-full bg-background px-3 py-1 font-mono text-[11px] uppercase ring-1 ring-line">{row.status}</span>
            </div>

            <div className="mt-4 rounded-lg bg-background p-4">
              <div className="font-semibold">{row.headline}</div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{row.description}</p>
              {row.creative_url && <a className="mt-2 inline-block text-xs text-primary underline" href={row.creative_url} target="_blank" rel="noreferrer">Open proposed creative</a>}
            </div>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div><dt className="label-mono">Campaign dates</dt><dd className="mt-1">{row.campaign_start} – {row.campaign_end}</dd></div>
              <div><dt className="label-mono">Indicative budget</dt><dd className="mt-1">{row.budget}</dd></div>
              <div><dt className="label-mono">Landing page</dt><dd className="mt-1 truncate"><a className="text-primary underline" href={row.landing_url} target="_blank" rel="noreferrer">{row.landing_url}</a></dd></div>
              <div><dt className="label-mono">Received</dt><dd className="mt-1">{new Date(row.created_at).toLocaleString("en-GB")}</dd></div>
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <a href={`mailto:${encodeURIComponent(row.email)}?subject=${encodeURIComponent(`Bridgeway advertising · ${row.brand_name}`)}`}><Mail className="size-4" />Contact brand</a>
              </Button>
              {STATUSES.filter((status) => status !== row.status).map((status) => (
                <Button
                  key={status}
                  variant={status === "approved" ? "default" : "ghost"}
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate({ id: row.id, status })}
                >
                  {status === "approved" ? "Approve & publish" : status === "declined" ? "Decline" : status === "reviewing" ? "Mark reviewing" : "Reopen"}
                </Button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
