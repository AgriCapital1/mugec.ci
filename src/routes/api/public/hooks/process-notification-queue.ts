import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BRAND_NAME = "MUGEC-CI";
const BRAND_FOOTER = "MUGEC-CI · Mutuelle Générale des Collectivités de Côte d'Ivoire";
const BRAND_LOGO_URL =
  process.env.BRAND_LOGO_URL ?? "https://mugec-ci.ivoireprojet.com/mugec-logo.png";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtml(subject: string, body: string) {
  const safe = escapeHtml(body).replace(/\n/g, "<br/>");
  return `<!doctype html><html><body style="margin:0;background:#f5f7fb;font-family:Inter,Arial,sans-serif;color:#0f172a">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px 0">
      <tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.08)">
          <tr><td style="background:linear-gradient(135deg,#0b5cad,#1f8a8b);padding:20px 28px" align="left">
            <img src="${BRAND_LOGO_URL}" alt="${BRAND_NAME}" height="48" style="display:block;height:48px;border:0"/>
          </td></tr>
          <tr><td style="padding:28px">
            <h1 style="margin:0 0 12px;font-size:20px;color:#0b5cad">${escapeHtml(subject)}</h1>
            <div style="font-size:15px;line-height:1.6;color:#0f172a">${safe}</div>
          </td></tr>
          <tr><td style="padding:18px 28px;background:#f8fafc;color:#64748b;font-size:12px" align="center">
            © ${new Date().getFullYear()} ${BRAND_FOOTER}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

async function sendBrevoEmail(to: string, subject: string, body: string) {
  const brevoKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL ?? "no-reply@mugec-ci.ci";
  const senderName = process.env.BREVO_SENDER_NAME ?? BRAND_NAME;
  if (!brevoKey) return { ok: false, error: "BREVO_API_KEY missing" };
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": brevoKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email: to }],
        subject,
        htmlContent: buildHtml(subject, body),
        textContent: body,
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `Brevo ${res.status}: ${txt.slice(0, 200)}` };
    }
    const json = (await res.json().catch(() => ({}))) as { messageId?: string };
    return { ok: true, reference: json.messageId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function renderTemplate(tpl: string, ctx: Record<string, unknown>) {
  return tpl.replace(/{{\s*(\w+)\s*}}/g, (_, k) => String(ctx[k] ?? ""));
}

type QueueRow = {
  id: string;
  member_id: string | null;
  user_id: string | null;
  canal: string;
  event: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
};

export const Route = createFileRoute("/api/public/hooks/process-notification-queue")({
  server: {
    handlers: {
      POST: async () => {
        // Pull a batch of pending items
        const { data: rows, error } = await supabaseAdmin
          .from("notification_queue")
          .select("id, member_id, user_id, canal, event, payload, attempts, max_attempts")
          .eq("status", "pending")
          .lte("scheduled_at", new Date().toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(25);

        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        const items = (rows ?? []) as QueueRow[];
        let sent = 0;
        let failed = 0;

        for (const row of items) {
          // Mark processing
          await supabaseAdmin
            .from("notification_queue")
            .update({ status: "processing", attempts: row.attempts + 1 })
            .eq("id", row.id);

          // Find template
          const { data: tpl } = await supabaseAdmin
            .from("notification_templates")
            .select("title, body, channel")
            .eq("event", row.event)
            .eq("channel", row.canal)
            .eq("active", true)
            .maybeSingle();

          // Resolve email
          let toEmail: string | null = (row.payload?.email as string) ?? null;
          if (!toEmail && row.member_id) {
            const { data: m } = await supabaseAdmin
              .from("members")
              .select("email")
              .eq("id", row.member_id)
              .maybeSingle();
            toEmail = m?.email ?? null;
          }

          const subject = tpl
            ? renderTemplate(tpl.title, row.payload)
            : `[${BRAND_NAME}] ${row.event}`;
          const body = tpl
            ? renderTemplate(tpl.body, row.payload)
            : `Notification ${row.event}\n\n${JSON.stringify(row.payload, null, 2)}`;

          let result: { ok: boolean; error?: string; reference?: string } = {
            ok: false,
            error: "unsupported_channel",
          };

          if (row.canal === "email" && toEmail) {
            result = await sendBrevoEmail(toEmail, subject, body);
          } else if (row.canal === "in_app" && row.user_id) {
            const { error: insErr } = await supabaseAdmin
              .from("notifications")
              .insert({ user_id: row.user_id, channel: "in_app", title: subject, body });
            result = insErr ? { ok: false, error: insErr.message } : { ok: true };
          } else if (!toEmail && row.canal === "email") {
            result = { ok: false, error: "no_recipient" };
          }

          // Log to notifications_log
          await supabaseAdmin.from("notifications_log").insert({
            member_id: row.member_id,
            user_id: row.user_id,
            canal: row.canal,
            event: row.event,
            contenu: `${subject}\n\n${body}`,
            statut: result.ok ? "envoye" : "echoue",
            provider: row.canal === "email" ? "brevo" : null,
            provider_reference: result.reference ?? null,
            error_message: result.error ?? null,
            sent_at: result.ok ? new Date().toISOString() : null,
          });

          // Update queue row
          if (result.ok) {
            await supabaseAdmin
              .from("notification_queue")
              .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
              .eq("id", row.id);
            sent++;
          } else {
            const giveUp = row.attempts + 1 >= row.max_attempts;
            await supabaseAdmin
              .from("notification_queue")
              .update({
                status: giveUp ? "failed" : "pending",
                last_error: result.error ?? "unknown",
                scheduled_at: giveUp
                  ? new Date().toISOString()
                  : new Date(Date.now() + 5 * 60_000).toISOString(),
              })
              .eq("id", row.id);
            failed++;
          }
        }

        return new Response(
          JSON.stringify({ ok: true, processed: items.length, sent, failed }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
