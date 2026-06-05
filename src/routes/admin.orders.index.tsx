import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ChevronRight, Zap } from "lucide-react";

import { adminListOrders } from "@/lib/api/orders.functions";
import { formatKM, formatOrderNo } from "@/lib/format";
import { STATUS_LABEL, STATUS_ORDER, STATUS_STYLES } from "@/components/order-status";

export const Route = createFileRoute("/admin/orders/")({
  component: OrdersList,
});

function OrdersList() {
  const [status, setStatus] = useState<string>("all");
  const fn = useServerFn(adminListOrders);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "orders", status],
    queryFn: () => fn({ data: { status } }),
  });

  return (
    <div className="p-6 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Narudžbe</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pregled i upravljanje svim narudžbama.
          </p>
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48 rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Svi statusi</SelectItem>
            <SelectItem value="pending">Na čekanju</SelectItem>
            <SelectItem value="in_progress">U obradi</SelectItem>
            <SelectItem value="printed">Štampano</SelectItem>
            <SelectItem value="shipped">Poslato</SelectItem>
            <SelectItem value="completed">Završeno</SelectItem>
            <SelectItem value="cancelled">Otkazano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Učitavanje...
          </div>
        ) : !data?.orders.length ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nema narudžbi.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {data.orders.map((o: any) => (
              <li key={o.id}>
                <Link
                  to="/admin/orders/$id"
                  params={{ id: o.id }}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/40"
                >
                  <div className="grid h-11 w-14 shrink-0 place-items-center rounded-xl bg-primary/5 font-mono text-[11px] font-semibold tabular-nums text-primary">
                    {formatOrderNo(o.order_number)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{o.full_name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[o.status as keyof typeof STATUS_STYLES] ?? ""}`}
                      >
                        {STATUS_LABEL[o.status as keyof typeof STATUS_LABEL] ?? o.status}
                      </span>
                      {o.same_day && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning-foreground">
                          <Zap className="h-3 w-3" /> Same day
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {o.city} · {o.phone} ·{" "}
                      {new Date(o.created_at).toLocaleString("bs-BA")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold tabular-nums">
                      {formatKM(Number(o.total_price))}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
