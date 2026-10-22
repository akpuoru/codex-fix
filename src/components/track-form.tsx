import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function TrackForm({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  const navigate = useNavigate();

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        const tracking = value.trim();
        if (tracking.length < 3) return;
        navigate({ to: "/track/$tracking", params: { tracking } });
      }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="MRD-26-4471-9920"
        aria-label="Tracking number"
        className="w-full rounded-md bg-background px-3 py-2.5 font-mono text-sm ring-1 ring-line focus:ring-2 focus:ring-primary focus:outline-none"
      />
      <Button
        type="submit"
        className="h-auto px-6 py-2.5 text-sm font-semibold"
      >
        Track
      </Button>
    </form>
  );
}
