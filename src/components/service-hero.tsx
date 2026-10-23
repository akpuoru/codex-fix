import type { ReactNode } from "react";

import cargoOperations from "@/assets/bridgeway-cargo-operations.jpg";

export function ServiceHero({
  imageAlt,
  children,
}: {
  imageAlt: string;
  children: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-secondary text-secondary-foreground">
      <img
        src={cargoOperations}
        alt={imageAlt}
        width={1600}
        height={900}
        className="absolute inset-0 -z-20 size-full object-cover object-center"
      />
      <div className="hero-scrim absolute inset-0 -z-10" />
      <div className="mx-auto flex min-h-[510px] max-w-[1440px] flex-col justify-center px-6 py-12 sm:min-h-[560px] lg:px-12">
        {children}
      </div>
    </section>
  );
}
