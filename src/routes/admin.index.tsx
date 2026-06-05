import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Package,
  Clock,
  Truck,
  CheckCircle2,
  Wallet,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
  const s = data?.stats as any;
  const [range, setRange] = useState<"daily" | "monthly">("daily");

  const orderCards = [
    { label: "Ukupno", value: s?.total ?? 0, icon: Package, tint: "text-primary bg-primary/10" },
    { label: "Na čekanju", value: s?.pending ?? 0, icon: Clock, tint: "text-warning-foreground bg-warning/15" },
    { label: "U obradi", value: s?.inProgress ?? 0, icon: Clock, tint: "text-primary bg-primary/10" },
    { label: "Poslato", value: s?.shipped ?? 0, icon: Truck, tint: "text-primary bg-primary/10" },
    { label: "Završeno", value: s?.completed ?? 0, icon: CheckCircle2, tint: "text-success bg-success/15" },
  ];

  const chartData =
    range === "daily"
      ? (s?.daily ?? []).map((d: any) => ({
          label: d.date.slice(5), // MM-DD
          orders: d.orders,
          revenue: d.revenue,
        }))
      : (s?.monthly ?? []).map((m: any) => ({
          label: m.month.slice(2), // YY-MM
          orders: m.orders,
          revenue: m.revenue,
        }));

  return (
    <div className="p-6 sm:p-10">
      {/* Hero KPIs */}
      <div className="rounded-3xl bg-gradient-to-br from-primary to-[oklch(0.45_0.18_270)] p-7 text-primary-foreground shadow-[var(--shadow-elevated)] sm:p-9">
        <p className="text-xs uppercase tracking-wider opacity-75">Dobrodošli nazad</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          Pregled poslovanja
        </h1>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Prihod (završeno)" value={s ? formatKM(s.revenue) : "—"} icon={<Wallet className="h-4 w-4" />} />
          <Kpi label="Na čekanju (potencijal)" value={s ? formatKM(s.pendingRevenue ?? 0) : "—"} icon={<Clock className="h-4 w-4" />} />
          <Kpi label="Troškovi" value={s ? formatKM(s.expenses) : "—"} icon={<TrendingDown className="h-4 w-4" />} />
          <Kpi label="Dobit (potvrđena)" value={s ? formatKM(s.profit) : "—"} icon={<TrendingUp className="h-4 w-4" />} highlight />
        </div>
        <p className="mt-4 text-[11px] opacity-70">
          Prihod i dobit ne uključuju troškove dostave i računaju se tek kada je narudžba u statusu "Završeno".
        </p>
      </div>

      {/* Charts */}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Prihod"
          subtitle={range === "daily" ? "Posljednjih 30 dana" : "Posljednjih 12 mjeseci"}
          range={range}
          onRangeChange={setRange}
        >
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.55 0.2 270)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="oklch(0.55 0.2 270)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0 0)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="oklch(0.6 0 0)" />
              <YAxis tick={{ fontSize: 11 }} stroke="oklch(0.6 0 0)" width={48} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.9 0 0)", fontSize: 12 }}
                formatter={(v: any) => [formatKM(Number(v)), "Prihod"]}
              />
              <Area type="monotone" dataKey="revenue" stroke="oklch(0.55 0.2 270)" strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Narudžbe"
          subtitle={range === "daily" ? "Posljednjih 30 dana" : "Posljednjih 12 mjeseci"}
          range={range}
          onRangeChange={setRange}
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0 0)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="oklch(0.6 0 0)" />
              <YAxis tick={{ fontSize: 11 }} stroke="oklch(0.6 0 0)" width={32} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.9 0 0)", fontSize: 12 }}
                formatter={(v: any) => [v, "Narudžbe"]}
              />
              <Bar dataKey="orders" fill="oklch(0.62 0.17 250)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Status cards — equal size */}
      <h2 className="mt-10 text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Status narudžbi
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {orderCards.map((c) => (
          <div
            key={c.label}
            className="flex h-32 flex-col justify-between rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-elevated)]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {c.label}
              </span>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${c.tint}`}>
                <c.icon className="h-4 w-4" />
              </span>
            </div>
            <div className="text-3xl font-semibold tabular-nums leading-none">
              {isLoading ? "…" : c.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  range,
  onRangeChange,
  children,
}: {
  title: string;
  subtitle: string;
  range: "daily" | "monthly";
  onRangeChange: (r: "daily" | "monthly") => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="inline-flex rounded-full bg-secondary p-0.5 text-xs font-medium">
          <button
            onClick={() => onRangeChange("daily")}
            className={`rounded-full px-3 py-1 transition-colors ${range === "daily" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
          >
            Dnevno
          </button>
          <button
            onClick={() => onRangeChange("monthly")}
            className={`rounded-full px-3 py-1 transition-colors ${range === "monthly" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
          >
            Mjesečno
          </button>
        </div>
      </div>
      <div className="mt-4">{children}</div>
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
    <div className={`rounded-2xl px-4 py-3 ${highlight ? "bg-white/20" : "bg-white/10"} backdrop-blur-sm`}>
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider opacity-75">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
