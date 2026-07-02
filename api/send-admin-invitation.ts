// Endpoint Vercel : envoie l'email d'invitation admin via Brevo, en utilisant
// un template HTML pro (logo MIPROJET dynamique + branding MUGEC-CI).
// Réservé au super_admin connecté (vérification via le token Supabase).
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://bjgpipxmafzxqqkwaiwq.supabase.co";
const PUBLISHABLE = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

const bodySchema = z.object({
  to_email: z.string().email(),
  to_name: z.string().min(1).max(200),
  portal: z.enum(["mugec", "miprojet"]),
  role: z.string().min(1).max(80),
  login_identifier: z.string().min(1).max(120),
  password: z.string().min(4).max(120),
});

function loginUrl(portal: "mugec" | "miprojet") {
  const base = process.env.PUBLIC_APP_URL || "https://mugecci.ivoireprojet.com";
  return portal === "miprojet" ? `${base}/miprojet` : `${base}/admin`;
}

function invitationHtml(v: z.infer<typeof bodySchema>) {
  const portalLabel = v.portal === "miprojet" ? "MIPROJET" : "MUGEC-CI";
  const url = loginUrl(v.portal);
  const accent = v.portal === "miprojet" ? "#1e5ba8" : "#0f7b3f";
  const logo = "https://mugecci.ivoireprojet.com/logo-miprojet.png"; // dynamique côté site
  return `<!doctype html><html><body style="margin:0;background:#f5f7fb;font-family:Inter,Arial,sans-serif;color:#111">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(20,30,60,.08)">
      <tr><td style="background:${accent};padding:22px 28px;color:#fff">
        <table width="100%"><tr>
          <td><img src="${logo}" alt="MIPROJET" height="42" style="display:block;border:0" /></td>
          <td align="right" style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.9">${portalLabel}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:28px">
        <h1 style="margin:0 0 6px;font-size:22px">Bonjour ${v.to_name},</h1>
        <p style="margin:0 0 18px;color:#334155;font-size:14px;line-height:1.55">
          Votre compte administrateur <strong>${portalLabel}</strong> vient d'être créé par MIPROJET pour la MUGEC-CI.
        </p>
        <table width="100%" style="border:1px solid #e2e8f0;border-radius:10px;margin:8px 0 18px">
          <tr><td style="padding:10px 14px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.06em">Rôle</td><td style="padding:10px 14px;font-weight:600">${v.role}</td></tr>
          <tr><td style="padding:10px 14px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.06em;border-top:1px solid #e2e8f0">Identifiant</td><td style="padding:10px 14px;font-family:ui-monospace,Menlo,monospace;border-top:1px solid #e2e8f0">${v.login_identifier}</td></tr>
          <tr><td style="padding:10px 14px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.06em;border-top:1px solid #e2e8f0">Mot de passe provisoire</td><td style="padding:10px 14px;font-family:ui-monospace,Menlo,monospace;border-top:1px solid #e2e8f0">${v.password}</td></tr>
        </table>
        <p style="text-align:center;margin:22px 0">
          <a href="${url}" style="background:${accent};color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block">Se connecter à ${portalLabel}</a>
        </p>
        <p style="margin:16px 0 0;font-size:12px;color:#64748b;line-height:1.6">
          Vous devrez changer ce mot de passe à la première connexion. Ne partagez jamais ces identifiants.
        </p>
      </td></tr>
      <tr><td style="background:#0f172a;color:#94a3b8;font-size:11px;padding:14px 28px;text-align:center">
        © ${new Date().getFullYear()} MUGEC-CI • Propulsé par MIPROJET
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

async function assertSuperAdmin(token: string) {
  if (!SUPABASE_URL || !PUBLISHABLE) throw new Error("Config Supabase publique manquante.");
  const client = createClient(SUPABASE_URL, PUBLISHABLE, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userRes } = await client.auth.getUser(token);
  if (!userRes.user) throw new Error("Session invalide.");
  const { data } = await client.from("user_roles").select("role").eq("user_id", userRes.user.id).eq("role", "super_admin").maybeSingle();
  if (!data) throw new Error("Réservé au super administrateur.");
}

export default async function handler(request: any, response: any) {
  response.setHeader("content-type", "application/json; charset=utf-8");
  if (request.method !== "POST") return response.status(405).json({ error: "Méthode non autorisée" });
  try {
    const token = String(request.headers?.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) throw new Error("Authorization manquante");
    await assertSuperAdmin(token);
    const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
    const data = bodySchema.parse(body);
    const brevoKey = process.env.BREVO_API_KEY;
    if (!brevoKey) return response.status(200).json({ ok: false, reason: "brevo_key_missing" });
    const portalLabel = data.portal === "miprojet" ? "MIPROJET" : "MUGEC-CI";
    const r = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "accept": "application/json", "api-key": brevoKey, "content-type": "application/json" },
      body: JSON.stringify({
        sender: {
          name: process.env.BREVO_SENDER_NAME || "MIPROJET · MUGEC-CI",
          email: process.env.BREVO_SENDER_EMAIL || "no-reply@ivoireprojet.com",
        },
        to: [{ email: data.to_email, name: data.to_name }],
        subject: `Vos accès ${portalLabel} — MUGEC-CI`,
        htmlContent: invitationHtml(data),
      }),
    });
    const txt = await r.text();
    if (!r.ok) return response.status(502).json({ ok: false, brevo_status: r.status, details: txt.slice(0, 400) });
    return response.status(200).json({ ok: true });
  } catch (e: any) {
    return response.status(500).json({ ok: false, error: e?.message ?? String(e) });
  }
}
