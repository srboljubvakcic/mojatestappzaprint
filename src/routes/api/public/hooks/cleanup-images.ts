import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/cleanup-images")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const nowIso = new Date().toISOString();
        const { data: due, error } = await supabaseAdmin
          .from("images")
          .select("id, storage_path")
          .eq("status", "active")
          .lt("delete_after", nowIso);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }
        if (!due || due.length === 0) {
          return Response.json({ deleted: 0 });
        }
        await supabaseAdmin.storage
          .from("order-images")
          .remove(due.map((d) => d.storage_path));
        await supabaseAdmin
          .from("images")
          .update({ status: "deleted" })
          .in(
            "id",
            due.map((d) => d.id),
          );
        return Response.json({ deleted: due.length });
      },
    },
  },
});
