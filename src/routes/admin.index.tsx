import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Package,
  Clock,
  Truck,
  CheckCircle2,
  Wallet,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { adminDashboardStats } from "@/lib/api/orders.functions";
import { formatKM } from "@/lib/format";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

function Dashboard() {
  const fn = useServerFn(adminDashboardStats);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => fn(),
  });
  const s = data?.stats;

  const orderCards = [
    { label: "Ukupno narudžbi", value: s?.total ?? 0, icon: Package, tint: "primary" },
    { label: "Na čekanju", value: s?.pending ?? 0, icon: Clock, tint: "warning" },
    { label: "U obradi", value: s?.inProgress ?? 0, icon: Clock, tint: "primary" },
    { label: "Poslato", value: s?.shipped ?? 0, icon: Truck, tint: "primary" },
    { label: "Završeno", value: s?.completed ?? 0, icon: CheckCircle2, tint: "success" },
  ];

  return (
    <div className="p-6 sm:p-10">
      <div className="rounded-3xl bg-gradient-to-br from-primary to-[oklch(0.45_0.18_270)] p-7 text-primary-foreground shadow-[var(--shadow-elevated)] sm:p-9">
        <p className="text-xs uppercase tracking-wider opacity-75">Dobrodošli nazad</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          Pregled poslovanja
        </h1>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            label="Prihod (završeno)"
            value={s ? formatKM(s.revenue) : "—"}
            icon={<Wallet className="h-4 w-4" />}
          />
          <Kpi
            label="Na čekanju (potencijal)"
            value={s ? formatKM((s as any).pendingRevenue ?? 0) : "—"}
            icon={<Clock className="h-4 w-4" />}
          />
          <Kpi
            label="Troškovi"
            value={s ? formatKM(s.expenses) : "—"}
            icon={<TrendingDown className="h-4 w-4" />}
          />
          <Kpi
            label="Dobit (potvrđena)"
            value={s ? formatKM(s.profit) : "—"}
            icon={<TrendingUp className="h-4 w-4" />}
            highlight
          />
        </div>
        <p className="mt-4 text-[11px] opacity-70">
          Prihod i dobit ne uključuju troškove dostave i računaju se tek kada je narudžba u statusu "Završeno".
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {orderCards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-elevated)]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {c.label}
              </span>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-3 text-3xl font-semibold tabular-nums">
              {isLoading ? "…" : c.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl px-4 py-3 ${
        highlight ? "bg-white/20" : "bg-white/10"
      } backdrop-blur-sm`}
    >
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider opacity-75">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
