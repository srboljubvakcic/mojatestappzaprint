import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

const r = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  resolve: {
    alias: [
      { find: /^@tanstack\/react-router$/, replacement: r("src/compat/tanstack-router.tsx") },
      { find: /^@tanstack\/react-start$/, replacement: r("src/compat/tanstack-start.ts") },
      { find: /^@\/lib\/api\/formats\.functions$/, replacement: r("src/lib/app-api.ts") },
      { find: /^@\/lib\/api\/orders\.functions$/, replacement: r("src/lib/app-api.ts") },
      { find: /^@\/lib\/api\/example\.functions$/, replacement: r("src/lib/app-api.ts") },
      { find: /^@\/integrations\/supabase\/auth-middleware$/, replacement: r("src/compat/tanstack-start.ts") },
      { find: /^@\/integrations\/supabase\/client\.server$/, replacement: r("src/integrations/supabase/client.ts") },
    ],
  },
});
