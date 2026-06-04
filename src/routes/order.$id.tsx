import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Package } from "lucide-react";
import { z } from "zod";

import { formatKM } from "@/lib/format";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/order/$id")({
  validateSearch: z.object({ total: z.number().optional() }),
  head: () => ({
    meta: [{ title: "Hvala na narudžbi — FotoPrint BiH" }],
  }),
  component: OrderConfirmation,
});

function OrderConfirmation() {
  const { id } = Route.useParams();
  const { total } = Route.useSearch();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-[var(--shadow-soft)] sm:p-12">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-success/15 text-success">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
            Hvala vam na narudžbi!
          </h1>
          <p className="mt-3 text-muted-foreground">
            Vaša narudžba je primljena. Kontaktirat ćemo vas uskoro radi potvrde.
          </p>

          <div className="mt-8 rounded-2xl bg-secondary p-5 text-left">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Package className="h-3.5 w-3.5" /> Referenca narudžbe
            </div>
            <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
              {id}
            </div>
            {typeof total === "number" && (
              <div className="mt-4 flex items-baseline justify-between border-t border-border pt-3">
                <span className="text-sm text-muted-foreground">Ukupno</span>
                <span className="text-xl font-semibold tabular-nums">
                  {formatKM(total)}
                </span>
              </div>
            )}
          </div>

          <Button asChild size="lg" className="mt-8 rounded-full px-6">
            <Link to="/">Nova narudžba</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
