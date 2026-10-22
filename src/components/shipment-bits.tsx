import { STATUS_LABEL, STATUS_PROGRESS } from "@/lib/rates";

const TONE: Record<string, string> = {
  booked: "bg-accent/10 text-accent",
  picked_up: "bg-accent/10 text-accent",
  in_transit: "bg-primary/10 text-primary",
  customs: "bg-caution/15 text-caution",
  out_for_delivery: "bg-primary/10 text-primary",
  delivered: "bg-success/10 text-success",
  exception: "bg-destructive/10 text-destructive",
};

const BAR: Record<string, string> = {
  booked: "bg-accent",
  picked_up: "bg-accent",
  in_transit: "bg-primary",
  customs: "bg-caution",
  out_for_delivery: "bg-primary",
  delivered: "bg-success",
  exception: "bg-destructive",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-3 py-1 font-mono text-[11px] ${TONE[status] ?? "bg-track text-muted-foreground"}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function StatusDot({ status }: { status: string }) {
  return <span className={`size-2.5 shrink-0 rounded-full ${BAR[status] ?? "bg-muted"}`} />;
}

export function ProgressBar({ status, progress }: { status: string; progress?: number }) {
  const pct = progress ?? STATUS_PROGRESS[status] ?? 10;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-track">
      <div className={`h-full ${BAR[status] ?? "bg-muted"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EventRail({
  events,
}: {
  events: { status: string; location: string | null; note: string | null; occurred_at: string }[];
}) {
  if (events.length === 0) {
    return <p className="font-mono text-xs text-muted-foreground">No scan events yet.</p>;
  }
  return (
    <ol className="relative pl-6">
      <span className="absolute top-2 bottom-2 left-[7px] w-0.5 bg-line" />
      {events.map((event, index) => {
        const last = index === events.length - 1;
        return (
          <li key={`${event.occurred_at}-${index}`} className="relative pb-5 last:pb-0">
            <span
              className={`absolute top-1 left-[-17px] size-3.5 rounded-full ring-4 ${
                last ? "bg-primary ring-primary/20" : "bg-success ring-success/20"
              }`}
            />
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-mono text-xs">
                {event.note ?? STATUS_LABEL[event.status] ?? event.status}
                {event.location ? ` · ${event.location}` : ""}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {new Date(event.occurred_at).toLocaleString(undefined, {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
