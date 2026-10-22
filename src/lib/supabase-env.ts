/**
 * Resolves Supabase connection settings in every runtime this app deploys to:
 * - Browser bundle: only import.meta.env.VITE_* exists (baked in at build time).
 * - Node dev server: process.env is populated.
 * - Cloudflare Workers: process.env may be empty or undefined entirely, so the
 *   build-time VITE_* values (also baked into the server bundle) are the fallback.
 *
 * The service role key is intentionally NOT resolvable from VITE_* — secrets must
 * never be baked into the browser bundle.
 */

function readViteEnv(name: string): string | undefined {
  const value = (import.meta.env as Record<string, string | undefined>)[name];
  return value || undefined;
}

function readProcessEnv(name: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  return process.env[name] || undefined;
}

/** Project URL. Server prefers SUPABASE_URL; falls back to the baked VITE_ value. */
export function supabaseUrl(): string | undefined {
  return readProcessEnv("SUPABASE_URL") ?? readViteEnv("VITE_SUPABASE_URL") ?? readProcessEnv("VITE_SUPABASE_URL");
}

/** Publishable (public) key. Safe for browser and server use. */
export function supabasePublishableKey(): string | undefined {
  return (
    readProcessEnv("SUPABASE_PUBLISHABLE_KEY") ??
    readViteEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ??
    readProcessEnv("VITE_SUPABASE_PUBLISHABLE_KEY")
  );
}

/** Service role key. Server-only secret — never read from VITE_* variables. */
export function supabaseServiceRoleKey(): string | undefined {
  return readProcessEnv("SUPABASE_SERVICE_ROLE_KEY");
}
