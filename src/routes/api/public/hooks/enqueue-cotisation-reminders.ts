import { createFileRoute } from "@tanstack/react-router";

/**
 * Endpoint cron : enfile les rappels de cotisations en retard (J+3, J+7, J+14).
 * Appelé toutes les 24h par pg_cron. Idempotent grâce au guard NOT EXISTS dans la RPC.
 */
export const Route = createFileRoute("/api/public/hooks/enqueue-cotisation-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
        const provided = request.headers.get("apikey") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
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
