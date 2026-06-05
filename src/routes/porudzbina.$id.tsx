import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Package, MapPin, Phone, Mail, User } from "lucide-react";
import { z } from "zod";

import { formatKM, formatOrderNo } from "@/lib/format";
import { getOrderConfirmation } from "@/lib/api/orders.functions";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/porudzbina/$id")({
  validateSearch: z.object({ total: z.number().optional() }),
  head: () => ({
    meta: [{ title: "Hvala na narudžbi — FotoPrint BiH" }],
  }),
  component: OrderConfirmation,
});

function OrderConfirmation() {
  const { id } = Route.useParams();
  const fetchFn = useServerFn(getOrderConfirmation);
  const { data, isLoading } = useQuery({
    queryKey: ["order-confirmation", id],
    queryFn: () => fetchFn({ data: { id } }),
  });
  const order = data?.order;

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
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                  <Package className="h-3.5 w-3.5" /> Broj narudžbe
                </div>
                <div className="mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight">
                  {isLoading ? "…" : formatOrderNo(order?.order_number)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Ukupno
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">
                  {formatKM(Number(order?.total_price ?? 0))}
                </div>
              </div>
            </div>
          </div>

          {order && (
            <div className="mt-4 rounded-2xl border border-border bg-background p-5 text-left">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Podaci za dostavu
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                <InfoRow icon={<User className="h-3.5 w-3.5" />} value={order.full_name} />
                <InfoRow icon={<Phone className="h-3.5 w-3.5" />} value={order.phone} />
                {order.email && (
                  <InfoRow icon={<Mail className="h-3.5 w-3.5" />} value={order.email} />
                )}
                <InfoRow
                  icon={<MapPin className="h-3.5 w-3.5" />}
                  value={`${order.address}, ${order.city}${order.postal_code ? " · " + order.postal_code : ""}`}
                />
              </ul>
            </div>
          )}

          <Button asChild size="lg" className="mt-8 rounded-full px-6">
            <Link to="/">Nova narudžba</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function InfoRow({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="text-foreground">{value}</span>
    </li>
  );
}
