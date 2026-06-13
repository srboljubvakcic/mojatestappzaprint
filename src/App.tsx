import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route as RRRoute, Navigate } from "react-router-dom";

import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { RouteContextProvider } from "@/compat/tanstack-router";

import { Route as IndexRoute } from "@/routes/index";
import { Route as PrijavaRoute } from "@/routes/prijava";
import { Route as PorudzbinaIdRoute } from "@/routes/porudzbina.$id";
import { Route as PanelRoute } from "@/routes/panel";
import { Route as PanelIndexRoute } from "@/routes/panel.index";
import { Route as PanelFormatiRoute } from "@/routes/panel.formati";
import { Route as PanelIzvjestajiRoute } from "@/routes/panel.izvjestaji";
import { Route as PanelTroskoviRoute } from "@/routes/panel.troskovi";
import { Route as PanelPostavkeRoute } from "@/routes/panel.postavke";
import { Route as PanelPorudzbineIndexRoute } from "@/routes/panel.porudzbine.index";
import { Route as PanelPorudzbineIdRoute } from "@/routes/panel.porudzbine.$id";

const queryClient = new QueryClient();

function AuthSync() {
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouteContextProvider value={{ queryClient }}>
        <BrowserRouter>
          <AuthSync />
          <Routes>
            <RRRoute path="/" element={<IndexRoute.component />} />
            <RRRoute path="/prijava" element={<PrijavaRoute.component />} />
            <RRRoute path="/porudzbina/:id" element={<PorudzbinaIdRoute.component />} />
            <RRRoute path="/panel" element={<PanelRoute.component />}>
              <RRRoute index element={<PanelIndexRoute.component />} />
              <RRRoute path="formati" element={<PanelFormatiRoute.component />} />
              <RRRoute path="izvjestaji" element={<PanelIzvjestajiRoute.component />} />
              <RRRoute path="troskovi" element={<PanelTroskoviRoute.component />} />
              <RRRoute path="postavke" element={<PanelPostavkeRoute.component />} />
              <RRRoute path="porudzbine" element={<PanelPorudzbineIndexRoute.component />} />
              <RRRoute path="porudzbine/:id" element={<PanelPorudzbineIdRoute.component />} />
            </RRRoute>
            <RRRoute path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors />
      </RouteContextProvider>
    </QueryClientProvider>
  );
}
