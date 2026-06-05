import { Link } from "@tanstack/react-router";
import { Camera, MessageCircle } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Camera className="h-4 w-4" />
          </span>
          <span>FotoPrint BiH</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <a
            href="https://wa.me/38760000000"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-muted-foreground transition-colors hover:bg-accent"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Podrška
          </a>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/70 py-10 text-sm text-muted-foreground">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6">
        <p>© {new Date().getFullYear()} FotoPrint BiH</p>
        <p>Dostava u cijeloj Bosni i Hercegovini</p>
      </div>
    </footer>
  );
}
