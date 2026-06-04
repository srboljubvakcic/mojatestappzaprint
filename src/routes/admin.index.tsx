import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Package, Clock, Truck, CheckCircle2, Wallet } from "lucide-react";

import { adminDashboardStats } from "@/lib/api/orders.functions";
import { formatKM } from "@/lib/format";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

function Dashboard() {
  const fn = useServerFn(adminDashboardStats);
  const { data } = useQuery({ queryKey: ["admin", "stats"], queryFn: () => fn() });
  const s = data?.stats;

  const cards = [
    { label: "Ukupno narudžbi", value: s?.total ?? 0, icon: Package },
    { label: "Na čekanju", value: s?.pending ?? 0, icon: Clock },
    { label: "U obradi", value: s?.inProgress ?? 0, icon: Clock },
    { label: "Poslato", value: s?.shipped ?? 0, icon: Truck },
    { label: "Završeno", value: s?.completed ?? 0, icon: CheckCircle2 },
    {
      label: "Prihod",
      value: s ? formatKM(s.revenue) : formatKM(0),
      icon: Wallet,
    },
  ];

  return (
    <div className="p-6 sm:p-10">
      <h1 className="text-3xl font-semibold tracking-tight">Pregled</h1>
      <p className="mt-1 text-sm text-muted-foreground">Sažetak rada FotoPrint servisa.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {c.label}
              </span>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-3 text-3xl font-semibold tabular-nums">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
