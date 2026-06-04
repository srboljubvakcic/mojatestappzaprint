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
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/api/formats.functions";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
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
    router.navigate({ to: "/auth" });
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
    <div className="flex min-h-screen flex-col bg-background sm:flex-row">
      <aside className="border-b border-border bg-sidebar sm:w-64 sm:border-b-0 sm:border-r">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Camera className="h-4 w-4" />
          </span>
          <div>
            <div className="text-sm font-semibold">FotoPrint BiH</div>
            <div className="text-[11px] text-muted-foreground">Admin</div>
          </div>
        </div>
        <nav className="flex gap-1 px-3 pb-3 sm:flex-col">
          <NavItem to="/admin" icon={<LayoutDashboard className="h-4 w-4" />}>
            Pregled
          </NavItem>
          <NavItem to="/admin/orders" icon={<Package className="h-4 w-4" />}>
            Narudžbe
          </NavItem>
          <NavItem to="/admin/formats" icon={<Settings className="h-4 w-4" />}>
            Formati
          </NavItem>
        </nav>
        <div className="mt-auto hidden border-t border-border p-3 sm:block">
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
      activeOptions={{ exact: to === "/admin" }}
      activeProps={{
        className:
          "flex items-center gap-2 rounded-xl bg-sidebar-accent px-3 py-2 text-sm font-medium text-sidebar-accent-foreground",
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
