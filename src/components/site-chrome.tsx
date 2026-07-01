import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { getPublicSettings } from "@/lib/app-api";

export function BrandMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <span
      className={`relative grid place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/70 text-primary-foreground shadow-[0_6px_20px_-6px_hsl(var(--primary)/0.55)] ${className}`}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-[58%] w-[58%]">
        <path
          d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2.2l1-1.6A2 2 0 0 1 11.4 3.5h1.2c.7 0 1.35.36 1.7.95L15.3 6h2.2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12.5" r="1.1" fill="currentColor" />
      </svg>
      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-white/90 shadow-sm" />
    </span>
  );
}

export function SiteHeader() {
  const { data } = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => getPublicSettings(),
    staleTime: 60_000,
  });
  const s = data?.settings as any;
  const supportEnabled = s?.support_enabled ?? true;
  const phone = (s?.support_phone ?? "").toString();
  const waNumber = phone.replace(/[^0-9]/g, "");

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <BrandMark />
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-tight">
              Izrada<span className="text-primary">.</span>Online
            </span>
            <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Foto štampa
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {supportEnabled && waNumber && (
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-muted-foreground transition-colors hover:bg-accent"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Podrška
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/70 py-10 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6">
        <p>© {new Date().getFullYear()} Izrada.Online</p>
        <p>Dostava u cijeloj Bosni i Hercegovini</p>
      </div>
    </footer>
  );
}
