import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

type LL = [number, number];

const KNOWN: Record<string, LL> = {
  frankfurt: [50.11, 8.68], london: [51.51, -0.13], "new york": [40.71, -74.0],
  "mexico city": [19.43, -99.13], dubai: [25.2, 55.27], singapore: [1.35, 103.82],
  tokyo: [35.68, 139.69], sydney: [-33.87, 151.21], johannesburg: [-26.2, 28.05],
  lagos: [6.52, 3.38], paris: [48.86, 2.35], "hong kong": [22.32, 114.17],
};

const cache = new Map<string, LL | null>();
async function geocode(q: string): Promise<LL | null> {
  const key = q.toLowerCase().trim();
  for (const [k, v] of Object.entries(KNOWN)) if (key.includes(k)) return v;
  if (cache.has(key)) return cache.get(key)!;
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
    );
    const j = (await r.json()) as { lat: string; lon: string }[];
    const v: LL | null = j[0] ? [+j[0].lat, +j[0].lon] : null;
    cache.set(key, v);
    return v;
  } catch {
    return null;
  }
}

// curved path between two points (simple bezier, works well on a flat map)
function arc(a: LL, b: LL, n = 80): LL[] {
  const mid: LL = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const dx = b[1] - a[1], dy = b[0] - a[0];
  const ctrl: LL = [mid[0] + dx * 0.18, mid[1] - dy * 0.18];
  const pts: LL[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push([
      u * u * a[0] + 2 * u * t * ctrl[0] + t * t * b[0],
      u * u * a[1] + 2 * u * t * ctrl[1] + t * t * b[1],
    ]);
  }
  return pts;
}

export function LiveMap(props: {
  origin: string;
  dest: string;
  current: string | null;
  progress: number;
  delivered?: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ok" | "fail">("loading");

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let map: import("leaflet").Map | null = null;
    (async () => {
      const L = (await import("leaflet")).default;
      const [o, d] = await Promise.all([geocode(props.origin), geocode(props.dest)]);
      if (cancelled || !el.current) return;
      if (!o || !d) { setState("fail"); return; }
      const cur = props.current ? await geocode(props.current) : null;
      if (cancelled || !el.current) return;

      map = L.map(el.current, { zoomControl: true, scrollWheelZoom: false, attributionControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 18,
      }).addTo(map);

      const route = arc(o, d);
      const pct = Math.max(0, Math.min(1, props.delivered ? 1 : props.progress / 100));
      const target: LL = cur ?? route[Math.round(pct * (route.length - 1))]!;
      // path traveled: origin -> current -> (remaining) destination
      const traveled = cur ? arc(o, cur, 50) : route.slice(0, Math.round(pct * (route.length - 1)) + 1);
      const remaining = cur ? arc(cur, d, 50) : route.slice(Math.round(pct * (route.length - 1)));

      L.polyline(remaining, { color: "#102A43", weight: 2, opacity: 0.45, dashArray: "6 8", className: "bw-dash" }).addTo(map);
      const done = L.polyline([traveled[0]!], { color: "#F97316", weight: 4, opacity: 0.95 }).addTo(map);

      const pin = (c: string, label: string) =>
        L.divIcon({
          className: "",
          html: `<div style="display:flex;flex-direction:column;align-items:center"><div style="width:14px;height:14px;border-radius:50%;background:${c};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div><div style="margin-top:2px;font:600 10px 'IBM Plex Sans',sans-serif;background:#fff;padding:1px 5px;border-radius:3px;box-shadow:0 1px 3px rgba(0,0,0,.25);white-space:nowrap">${label}</div></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
      L.marker(o, { icon: pin("#075985", "Origin") }).addTo(map);
      L.marker(d, { icon: pin("#102A43", "Destination") }).addTo(map);

      const truck = L.marker(traveled[0]!, {
        icon: L.divIcon({
          className: "",
          html: `<div class="bw-pulse" style="position:relative;width:34px;height:34px;display:grid;place-items:center"><span style="position:absolute;inset:0;border-radius:50%;background:rgba(249,115,22,.35);animation:bwping 1.6s ease-out infinite"></span><span style="position:relative;width:26px;height:26px;border-radius:50%;background:#F97316;border:3px solid #fff;display:grid;place-items:center;box-shadow:0 2px 6px rgba(0,0,0,.35);color:#fff;font-size:13px">✈</span></div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
        zIndexOffset: 1000,
      })
        .bindTooltip(props.current ?? "In transit", { direction: "top", offset: [0, -16] })
        .addTo(map);

      map.fitBounds(L.latLngBounds([o, d, target]), { padding: [40, 40] });
      setState("ok");

      // animate the parcel along the traveled path
      const start = performance.now();
      const dur = 2800;
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        const e = 1 - Math.pow(1 - t, 3);
        const idx = Math.max(1, Math.round(e * (traveled.length - 1)));
        const pts = traveled.slice(0, idx + 1);
        done.setLatLngs(pts);
        truck.setLatLng(pts[pts.length - 1]!);
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      map?.remove();
    };
  }, [props.origin, props.dest, props.current, props.progress, props.delivered]);

  return (
    <div className="relative overflow-hidden rounded-lg ring-1 ring-line">
      <style>{`@keyframes bwping{0%{transform:scale(.6);opacity:1}100%{transform:scale(1.8);opacity:0}}@keyframes bwdash{to{stroke-dashoffset:-28}}.bw-dash{animation:bwdash 1.2s linear infinite}`}</style>
      <div ref={el} className="h-[320px] w-full bg-muted" />
      {state !== "ok" && (
        <div className="absolute inset-0 grid place-items-center bg-muted font-mono text-xs text-muted-foreground">
          {state === "loading" ? "Loading live map…" : "Map unavailable for this route"}
        </div>
      )}
      <div className="pointer-events-none absolute right-3 top-3 z-[500] flex items-center gap-2 rounded-full bg-card px-3 py-1 font-mono text-[10px] uppercase tracking-wider shadow ring-1 ring-line">
        <span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> Live position
      </div>
    </div>
  );
}
