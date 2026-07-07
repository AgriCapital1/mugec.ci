import { createFileRoute } from "@tanstack/react-router";

/**
 * Endpoint one-shot pour réaligner les mots de passe des deux comptes admin
 * (MUGEC-CI + MIPROJET) sur les valeurs stockées dans les secrets serveur.
 *
 * Sécurité :
 * - Aucun secret n'est jamais renvoyé ni journalisé.
 * - L'appel exige le header `x-admin-reset-token: <ADMIN_RESET_TOKEN>`.
 * - Tout succès est tracé dans `sensitive_audit_log` (scope=admin_credentials).
 *
 * Usage (à exécuter UNE FOIS après chaque rotation, depuis un terminal sûr) :
 *   curl -X POST https://<domain>/api/public/hooks/reset-admin-credentials \
 *        -H "x-admin-reset-token: $ADMIN_RESET_TOKEN"
 */
export const Route = createFileRoute("/api/public/hooks/reset-admin-credentials")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const expected = process.env.ADMIN_RESET_TOKEN;
        const provided = request.headers.get("x-admin-reset-token");
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const mugecPwd = process.env.ADMIN_MUGEC_PASSWORD;
        const miprojetPwd = process.env.ADMIN_MIPROJET_PASSWORD;
        if (!mugecPwd || !miprojetPwd) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: "Missing ADMIN_MUGEC_PASSWORD or ADMIN_MIPROJET_PASSWORD",
            }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }

        const targets: Array<{ email: string; password: string; label: string }> = [
          { email: "adminmgec@mugec-ci.local", password: mugecPwd, label: "adminmgec" },
          { email: "admininoce@miprojet.local", password: miprojetPwd, label: "admininoce" },
        ];

        const report: Array<{ label: string; ok: boolean; error?: string }> = [];

        for (const t of targets) {
          // Trouver l'utilisateur (paginé sur 200 max — largement assez pour 2 admins)
          const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 200,
          });
          if (listErr) {
            report.push({ label: t.label, ok: false, error: listErr.message });
            continue;
          }
          const user = list.users.find(
            (u) => u.email?.toLowerCase() === t.email.toLowerCase(),
          );
          if (!user) {
            report.push({ label: t.label, ok: false, error: "user_not_found" });
            continue;
          }
          const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(
            user.id,
            { password: t.password, email_confirm: true },
          );
          if (updErr) {
            report.push({ label: t.label, ok: false, error: updErr.message });
            continue;
          }

          await supabaseAdmin.rpc("log_sensitive_event", {
            _scope: "admin_credentials",
            _action: "password_reset",
            _target_id: user.id,
            _target_label: t.label,
            _details: { source: "reset-admin-credentials endpoint" },
          });

          report.push({ label: t.label, ok: true });
        }

        return new Response(JSON.stringify({ ok: true, report }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
