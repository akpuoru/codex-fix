import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="mt-14 bg-secondary text-secondary-foreground">
      <div className="mx-auto grid max-w-[1440px] gap-8 px-6 py-10 sm:grid-cols-3">
        <div>
          <div className="notranslate font-display text-lg font-bold">BRIDGEWAY</div>
          <p className="mt-2 max-w-xs text-sm text-secondary-foreground/65">Flight reservations, hotel stays, car hire and courier, luggage and freight delivery across international routes.</p>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary-foreground/50">Operations</div>
          <p className="mt-2 text-sm">Flight, hotel and car reservations<br />24/7 shipment visibility</p>
        </div>
        <div className="sm:text-right">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary-foreground/50">Customer care</div>
          <Link to="/contact" className="mt-3 inline-block text-sm font-semibold hover:underline">Contact our team →</Link>
          <br />
          <Link to="/advertise" className="mt-2 inline-block text-sm font-semibold hover:underline">Advertise with us →</Link>
          <p className="mt-2 text-xs text-secondary-foreground/65">Flight, hotel, car hire and shipment enquiries</p>
        </div>
      </div>
      <div className="border-t border-secondary-foreground/10 px-6 py-4 text-center text-xs text-secondary-foreground/50">© 2026 <span className="notranslate">Bridgeway Freighting</span>. International delivery, handled with care.</div>
    </footer>
  );
}
