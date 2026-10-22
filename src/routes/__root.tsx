import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { getSiteSettings } from "@/lib/settings.functions";
import { DEFAULT_PRICING, setPricing } from "@/lib/rates";
import { SupportChat } from "@/components/support-chat";
import { AutoTranslate } from "@/components/auto-translate";
import { AccountGuard } from "@/components/account-guard";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="label-mono">Error 404 · unrouted</div>
        <h1 className="mt-3 font-display text-6xl font-black tracking-tight">No such lane</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This page is not on the network map.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-md bg-foreground px-5 py-2.5 font-display text-sm font-bold text-background transition-colors hover:bg-primary"
        >
          Back to the terminal
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="label-mono">Belt stopped</div>
        <h1 className="mt-3 font-display text-3xl font-black tracking-tight">
          This page didn&apos;t load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-5 py-2.5 font-display text-sm font-bold text-primary-foreground"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-md border border-line bg-card px-5 py-2.5 font-display text-sm font-bold"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Bridgeway Freighting" },
      {
        name: "description",
        content:
          "Bridgeway Freighting moves parcels, luggage and freight across 140 international corridors with instant rates and live tracking.",
      },
      { property: "og:title", content: "Bridgeway Freighting" },
      {
        property: "og:description",
        content: "Bridgeway Freighting — international courier, luggage and freight network.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Bridgeway Freighting" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Libre+Baskerville:wght@400;700&display=swap",
      },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  loader: async () => {
    const pricing = await getSiteSettings().catch(() => DEFAULT_PRICING);
    setPricing(pricing);
    return { pricing };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent as never,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const { pricing } = Route.useLoaderData();
  setPricing(pricing);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      if (event === "SIGNED_OUT") {
        for (const k of Object.keys(localStorage)) if (k.startsWith("bw-login-at-")) localStorage.removeItem(k);
        for (const k of Object.keys(sessionStorage)) if (k.startsWith("bw-login-at-")) sessionStorage.removeItem(k);
      }
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        void queryClient.cancelQueries();
        queryClient.clear();
      }
      router.invalidate();
      if (event === "USER_UPDATED") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster position="top-right" />
      <AutoTranslate />
      <SupportChat />
      <AccountGuard />
    </QueryClientProvider>
  );
}
