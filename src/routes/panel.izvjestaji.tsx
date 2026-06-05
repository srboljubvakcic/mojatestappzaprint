import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Package,
  CheckCircle2,
  XCircle,
  Percent,
  Activity,
} from "lucide-react";

import { adminReports } from "@/lib/api/orders.functions";
import { formatKM } from "@/lib/format";
import { STATUS_LABEL } from "@/components/order-status";

export const Route = createFileRoute("/panel/izvjestaji")({
  component: ReportsPage,
});

const PIE_COLORS = [
  "oklch(0.6 0.2 270)",
  "oklch(0.7 0.18 80)",
  "oklch(0.65 0.18 250)",
  "oklch(0.7 0.15 150)",
  "oklch(0.65 0.2 20)",
  "oklch(0.6 0.15 200)",
];

const EXP_LABEL: Record<string, string> = {
  materials: "Materijal",
  shipping: "Dostava",
  marketing: "Marketing",
  equipment: "Oprema",
  software: "Softver",
  rent: "Najam",
  utilities: "Režije",
  other: "Ostalo",
};

function ReportsPage() {
  const fn = useServerFn(adminReports);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "reports"],
    queryFn: () => fn(),
  });
  const r = data?.report as any;

  const delta = (a: number, b: number) => {
    if (!b) return a > 0 ? 100 : 0;
    return ((a - b) / b) * 100;
  };
  const ordersDelta = r ? delta(r.thisMonth.orders, r.lastMonth.orders) : 0;
  const revenueDelta = r ? delta(r.thisMonth.revenue, r.lastMonth.revenue) : 0;

  const statusData = r
    ? Object.entries(r.statusDist).map(([k, v]) => ({
        name: STATUS_LABEL[k as keyof typeof STATUS_LABEL] ?? k,
        value: v as number,
      }))
    : [];

  return (
    <div className="p-6 sm:p-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Izvještaji</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Detaljan pregled poslovanja, trendovi i ključni pokazatelji.
        </p>
      </div>

      {isLoading || !r ? (
        <div className="mt-10 grid h-64 place-items-center text-sm text-muted-foreground">
          Učitavanje...
        </div>
      ) : (
        <>
          {/* KPI grid */}
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi
              label="Prihod ukupno"
              value={formatKM(r.totals.revenue)}
              icon={<Wallet className="h-4 w-4" />}
              tint="text-primary bg-primary/10"
            />
            <Kpi
              label="Dobit"
              value={formatKM(r.totals.profit)}
              icon={<TrendingUp className="h-4 w-4" />}
              tint={r.totals.profit >= 0 ? "text-success bg-success/15" : "text-destructive bg-destructive/10"}
            />
            <Kpi
              label="Prosječna narudžba"
              value={formatKM(r.totals.avgOrderValue)}
              icon={<Activity className="h-4 w-4" />}
              tint="text-primary bg-primary/10"
            />
            <Kpi
              label="Stopa završenih"
              value={`${r.totals.completionRate.toFixed(1)}%`}
              icon={<Percent className="h-4 w-4" />}
              tint="text-success bg-success/15"
            />
            <Kpi
              label="Sve narudžbe"
              value={String(r.totals.orders)}
              icon={<Package className="h-4 w-4" />}
              tint="text-primary bg-primary/10"
            />
            <Kpi
              label="Završene"
              value={String(r.totals.completed)}
              icon={<CheckCircle2 className="h-4 w-4" />}
              tint="text-success bg-success/15"
            />
            <Kpi
              label="Otkazane"
              value={String(r.totals.cancelled)}
              icon={<XCircle className="h-4 w-4" />}
              tint="text-destructive bg-destructive/10"
            />
            <Kpi
              label="Troškovi"
              value={formatKM(r.totals.expenses)}
              icon={<TrendingDown className="h-4 w-4" />}
              tint="text-destructive bg-destructive/10"
            />
          </div>

          {/* Month over month */}
          <h2 className="mt-10 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Mjesec u toku vs prošli mjesec
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <CompareCard
              label="Narudžbe"
              now={r.thisMonth.orders}
              prev={r.lastMonth.orders}
              delta={ordersDelta}
              format={(v) => String(v)}
            />
            <CompareCard
              label="Prihod"
              now={r.thisMonth.revenue}
              prev={r.lastMonth.revenue}
              delta={revenueDelta}
              format={formatKM}
            />
          </div>

          {/* Distributions */}
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <Panel title="Distribucija statusa" subtitle="Sve narudžbe">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={3}
                  >
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Troškovi po kategoriji" subtitle="Ukupno do danas">
              {r.expenseByCategory.length ? (
                <ul className="space-y-3 pt-2">
                  {r.expenseByCategory.map((e: any, i: number) => {
                    const max = r.expenseByCategory[0].amount || 1;
                    return (
                      <li key={e.category}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{EXP_LABEL[e.category] ?? e.category}</span>
                          <span className="tabular-nums">{formatKM(e.amount)}</span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(e.amount / max) * 100}%`,
                              background: PIE_COLORS[i % PIE_COLORS.length],
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="grid h-48 place-items-center text-sm text-muted-foreground">
                  Nema unesenih troškova.
                </div>
              )}
            </Panel>
          </div>

          {/* Top tables */}
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <Panel title="Top gradovi" subtitle="Po broju narudžbi">
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Grad</th>
                      <th className="px-3 py-2 text-right">Narudžbe</th>
                      <th className="px-3 py-2 text-right">Prihod</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {r.topCities.map((c: any) => (
                      <tr key={c.city}>
                        <td className="px-3 py-2 font-medium">{c.city}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.orders}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatKM(c.revenue)}</td>
                      </tr>
                    ))}
                    {!r.topCities.length && (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                          Nema podataka.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Top formati" subtitle="Po broju kopija i prihodu">
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Format</th>
                      <th className="px-3 py-2 text-right">Kopije</th>
                      <th className="px-3 py-2 text-right">Prihod</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {r.topFormats.map((f: any) => (
                      <tr key={f.name}>
                        <td className="px-3 py-2 font-medium">{f.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{f.quantity}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatKM(f.revenue)}</td>
                      </tr>
                    ))}
                    {!r.topFormats.length && (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                          Nema podataka.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  tint,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tint: string;
}) {
  return (
    <div className="flex h-32 flex-col justify-between rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tint}`}>
          {icon}
        </span>
      </div>
      <div className="text-2xl font-semibold tabular-nums leading-none">{value}</div>
    </div>
  );
}

function CompareCard({
  label,
  now,
  prev,
  delta,
  format,
}: {
  label: string;
  now: number;
  prev: number;
  delta: number;
  format: (v: number) => string;
}) {
  const up = delta >= 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="text-3xl font-semibold tabular-nums">{format(now)}</span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
            up ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive"
          }`}
        >
          {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {Math.abs(delta).toFixed(1)}%
        </span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        Prošli mjesec: <span className="tabular-nums">{format(prev)}</span>
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}
