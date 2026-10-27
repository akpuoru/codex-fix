import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { LiveChatConversation } from "@/components/live-chat-conversation";
import { SupportChannels } from "@/components/support-channels";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";

export function SupportChat() {
  const [open, setOpen] = useState(false);
  const { user, loading } = useSession();
  const thread = useQuery({ queryKey: ["my-live-chat", user?.id], enabled: open && !!user, queryFn: async () => {
    const { data, error } = await supabase.rpc("start_live_chat");
    if (error || !data) throw new Error("Unable to open your chat. Please try again.");
    return data;
  } });
  return <Dialog open={open} onOpenChange={setOpen}>
    <div className="fixed right-4 bottom-5 z-40 flex flex-col items-end gap-2 print:hidden sm:right-6">
      <SupportChannels floating />
      <DialogTrigger asChild><Button aria-label="Chat with support" className="h-12 gap-2 rounded-full px-5 shadow-xl"><MessageCircle className="size-5" /><span>Live chat</span></Button></DialogTrigger>
    </div>
    <DialogContent className="max-h-[85dvh] overflow-y-auto print:hidden sm:max-w-md">
      <DialogHeader><DialogTitle className="font-display text-xl">Bridgeway live chat</DialogTitle><DialogDescription>Chat directly with our team. Replies appear here when an admin responds; response times may vary.</DialogDescription></DialogHeader>
      {loading ? <p className="py-6 text-sm text-muted-foreground">Checking your account…</p> : !user ? <div className="py-6"><p className="mb-5 text-sm text-muted-foreground">Sign in to keep your conversation private and return to it later.</p><Button asChild onClick={() => setOpen(false)}><Link to="/auth">Sign in to chat</Link></Button><Link to="/contact" onClick={() => setOpen(false)} className="mt-4 block text-sm text-primary hover:underline">Send an enquiry without signing in →</Link></div> : thread.isPending ? <p className="py-6 text-sm text-muted-foreground">Opening your conversation…</p> : thread.error ? <div role="alert"><p className="text-sm text-destructive">{thread.error.message}</p><Button className="mt-3" onClick={() => thread.refetch()}>Try again</Button></div> : <LiveChatConversation key={thread.data} threadId={thread.data} />}
    </DialogContent>
  </Dialog>;
}
