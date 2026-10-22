import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { checkMyAccount, recordLogin } from "@/lib/accounts.functions";

/** Records each sign-in (device + location) and enforces admin bans / forced sign-outs. */
export function AccountGuard() {
  const { user } = useSession();
  const record = useServerFn(recordLogin);
  const check = useServerFn(checkMyAccount);

  useEffect(() => {
    if (!user) return;
    const key = `bw-login-at-${user.id}`;
    let cancelled = false;

    const enforce = async () => {
      try {
        const s = await check();
        if (cancelled) return;
        const loginAt = localStorage.getItem(key);
        const kicked = s.forceLogoutAt && loginAt && new Date(s.forceLogoutAt) > new Date(loginAt);
        if (s.status === "banned" || kicked) {
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
          await supabase.auth.signOut();
          toast.error(s.status === "banned" ? "This account has been suspended. Contact customer care." : "You were signed out by an administrator.");
        }
      } catch { /* ignore transient errors */ }
    };

    (async () => {
      if (!sessionStorage.getItem(key)) {
        try {
          const { at } = await record();
          sessionStorage.setItem(key, "1");
          if (!localStorage.getItem(key)) localStorage.setItem(key, at);
        } catch { /* ignore */ }
      }
      if (!localStorage.getItem(key)) localStorage.setItem(key, new Date().toISOString());
      await enforce();
    })();
    const t = setInterval(enforce, 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, [user?.id]);

  return null;
}
