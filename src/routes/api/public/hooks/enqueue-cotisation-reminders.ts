import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Endpoint cron : enfile les rappels de cotisations en retard (J+3, J+7, J+14).
 * Appelé toutes les 24h par pg_cron. Idempotent grâce au guard NOT EXISTS dans la RPC.
 */
export const Route = createFileRoute("/api/public/hooks/enqueue-cotisation-reminders")({
  server: {
    handlers: {
      POST: async () => {
        const { data, error } = await supabaseAdmin.rpc(
          "enqueue_overdue_cotisation_reminders",
        );
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify({ ok: true, inserted: data ?? 0 }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
