import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard,
  Package,
  Settings,
  LogOut,
  Camera,
  Sliders,
  Receipt,
  BarChart3,
} from "lucide-react";


import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/api/formats.functions";

export const Route = createFileRoute("/panel")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/prijava" });
  },
  component: AdminLayout,
});

function AdminLayout() {
  const router = useRouter();
  const qc = useQueryClient();
  const checkAdmin = useServerFn(checkIsAdmin);
  const adminQ = useQuery({
    queryKey: ["isAdmin"],
    queryFn: () => checkAdmin(),
  });

  const logout = async () => {
    await supabase.auth.signOut();
    qc.clear();
    router.navigate({ to: "/prijava" });
  };

  if (adminQ.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Učitavanje...
      </div>
    );
  }
  if (adminQ.data && !adminQ.data.isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div className="max-w-md">
          <h1 className="text-2xl font-semibold">Nemate pristup</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ovaj nalog nije administrator.
          </p>
          <button
            onClick={logout}
            className="mt-6 rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground"
          >
            Odjavi se
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[oklch(0.985_0.004_250)] sm:flex-row">
      <aside className="flex flex-col border-b border-border bg-card/80 backdrop-blur-xl sm:w-64 sm:border-b-0 sm:border-r">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-primary to-[oklch(0.45_0.18_270)] text-primary-foreground shadow-[var(--shadow-soft)]">
            <Camera className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-semibold tracking-tight">FotoPrint BiH</div>
            <div className="text-[11px] text-muted-foreground">Admin panel</div>
          </div>
        </div>
        <nav className="flex gap-1 px-3 pb-3 sm:flex-col">
          <NavItem to="/panel" icon={<LayoutDashboard className="h-4 w-4" />}>
            Pregled
          </NavItem>
          <NavItem to="/panel/porudzbine" icon={<Package className="h-4 w-4" />}>
            Narudžbe
          </NavItem>
          <NavItem to="/panel/formati" icon={<Settings className="h-4 w-4" />}>
            Proizvodi
          </NavItem>
          <NavItem to="/panel/izvjestaji" icon={<BarChart3 className="h-4 w-4" />}>
            Izvještaji
          </NavItem>
          <NavItem to="/panel/troskovi" icon={<Receipt className="h-4 w-4" />}>
            Troškovi
          </NavItem>

          <NavItem to="/panel/postavke" icon={<Sliders className="h-4 w-4" />}>
            Postavke
          </NavItem>
        </nav>
        <div className="mt-auto hidden border-t border-border p-3 sm:block">
          <Link
            to="/"
            className="mb-1 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            ← Vrati se na sajt
          </Link>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> Odjavi se
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({
  to,
  icon,
  children,
}: {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/panel" }}
      activeProps={{
        className:
          "flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium text-primary",
      }}
      inactiveProps={{
        className:
          "flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
      }}
    >
      {icon}
      {children}
    </Link>
  );
}
