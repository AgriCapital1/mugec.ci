// Endpoint Vercel Serverless dédié à la gestion des administrateurs.
// Il fonctionne même sans SUPABASE_SERVICE_ROLE_KEY pour la création de
// comptes : dans ce cas il utilise l'inscription Supabase publique, puis le
// super_admin connecté assigne les rôles via RLS.
//
// Optionnels (envoi de l'invitation) :
//   - BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME
//   - WHATSAPP_API_URL, WHATSAPP_API_TOKEN
//   - PUBLIC_APP_URL (par défaut https://mugecci.ivoireprojet.com)

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { z } from "zod";

const MUGEC_ROLES = [
  "admin_national", "admin_regional", "admin_local", "agent_saisie",
  "president", "secretaire_general", "tresorier_national", "commissaire_comptes",
  "directeur_executif", "comite_controle", "conseil_sages", "secretaire_regional",
  "tresorier_regional", "delegue_section",
] as const;

const env = (name: string) => process.env[name] || "";
const DEFAULT_SUPABASE_URL = "https://bjgpipxmafzxqqkwaiwq.supabase.co";
const DEFAULT_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqZ3BpcHhtYWZ6eHFxa3dhaXdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMjAzMjUsImV4cCI6MjA5NDc5NjMyNX0.R0aa8YP5HTO_BPlt0OE9GdC5jzVffs3qzF3Tn8TIFGk";
const SUPABASE_URL = env("SUPABASE_URL") || env("VITE_SUPABASE_URL") || DEFAULT_SUPABASE_URL;
const PUBLISHABLE_KEY = env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY") || DEFAULT_PUBLISHABLE_KEY;
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY") || env("SERVICE_ROLE_KEY");

function requirePublicConfig() {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push("VITE_SUPABASE_URL");
  if (!PUBLISHABLE_KEY) missing.push("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (missing.length) {
    throw new Error(
      `Configuration Supabase publique introuvable : ${missing.join(", ")}.`,
    );
  }
}

function requireServiceConfig() {
  requirePublicConfig();
  if (!SERVICE_KEY) throw new Error("Action impossible sans clé serveur Supabase : utilisez la création de compte ou révoquez les rôles.");
}

function admin() {
  requireServiceConfig();
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function adminMaybe() {
  if (!SERVICE_KEY) return null;
  return admin();
}

function authed(token: string) {
  requirePublicConfig();
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function signupClient() {
  requirePublicConfig();
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function assertSuperAdmin(token: string) {
  const client = authed(token);
  const { data: userRes, error: userError } = await client.auth.getUser(token);
  if (userError || !userRes.user) throw new Error("Session invalide ou expirée.");
  const { data, error } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userRes.user.id)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Réservé au super administrateur.");
  return userRes.user.id;
}

function generatePassword() {
  return randomBytes(14).toString("base64url");
}

async function listAdminUsers() {
  const db = adminMaybe();
  if (!db) return { users: [], limited: true };
  const { data: roles, error } = await db
    .from("user_roles")
    .select("user_id, role, created_at");
  if (error) throw new Error(error.message);
  const adminSet = new Set<string>(["super_admin", "miprojet_admin", "miprojet_viewer", ...MUGEC_ROLES]);
  const map = new Map<string, { user_id: string; roles: string[]; created_at: string }>();
  for (const r of roles ?? []) {
    if (!adminSet.has(String(r.role))) continue;
    const cur = map.get(r.user_id) ?? { user_id: r.user_id, roles: [], created_at: r.created_at as string };
    cur.roles.push(String(r.role));
    map.set(r.user_id, cur);
  }
  const users: any[] = [];
  for (const id of Array.from(map.keys())) {
    try {
      const { data } = await db.auth.admin.getUserById(id);
      if (data?.user) {
        const entry = map.get(id)!;
        users.push({
          id,
          email: data.user.email,
          phone: data.user.phone,
          created_at: data.user.created_at,
          last_sign_in_at: data.user.last_sign_in_at,
          roles: entry.roles,
        });
      }
    } catch { /* ignore single user errors */ }
  }
  return { users };
}

const createSchema = z.object({
  email: z.string().email().max(255),
  phone: z.string().trim().max(20).optional().nullable(),
  full_name: z.string().trim().min(2).max(150),
  portal: z.enum(["mugec", "miprojet"]),
  role: z.string().min(2).max(80),
  send_via: z.enum(["email", "whatsapp"]).default("email"),
  password: z.string().min(6).max(60).optional(),
});

async function createAdminUser(input: unknown, actorId: string, token: string) {
  const data = createSchema.parse(input);
  let roleToInsert: string;
  if (data.portal === "mugec") {
    if (!(MUGEC_ROLES as readonly string[]).includes(data.role)) throw new Error("Rôle MUGEC-CI invalide.");
    roleToInsert = data.role;
  } else {
    if (!["super_admin", "miprojet_admin", "miprojet_viewer"].includes(data.role)) throw new Error("Rôle MIPROJET invalide.");
    roleToInsert = data.role;
  }

  const db = adminMaybe();
  const userDb = authed(token);
  const password = data.password || generatePassword();
  let userId: string | null = null;
  if (db) {
    const { data: created, error: createErr } = await db.auth.admin.createUser({
      email: data.email,
      phone: data.phone || undefined,
      password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, created_by_super_admin: true },
    });
    if (createErr) {
      const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existing = list?.users?.find((u: any) => u.email?.toLowerCase() === data.email.toLowerCase());
      if (!existing) throw new Error(`Création refusée : ${createErr.message}`);
      userId = existing.id;
    } else {
      userId = created.user?.id ?? null;
    }
  } else {
    const { data: signed, error: signErr } = await signupClient().auth.signUp({
      email: data.email,
      password,
      phone: data.phone || undefined,
      options: {
        data: { full_name: data.full_name, created_by_super_admin: true },
        emailRedirectTo: `${env("PUBLIC_APP_URL") || "https://mugecci.ivoireprojet.com"}${data.portal === "miprojet" ? "/miprojet" : "/admin"}`,
      },
    });
    if (signErr) throw new Error(`Création refusée : ${signErr.message}`);
    userId = signed.user?.id ?? null;
  }
  if (!userId) throw new Error("Impossible de créer l'utilisateur.");

  const roleWrite = await userDb
    .from("user_roles")
    .upsert({ user_id: userId, role: roleToInsert as any }, { onConflict: "user_id,role", ignoreDuplicates: true });
  if (roleWrite.error) throw new Error(`Rôle non assigné : ${roleWrite.error.message}`);

  const securityWrite = await userDb.from("user_security").upsert({
    user_id: userId,
    must_change_password: true,
    password_changed_at: null,
    updated_at: new Date().toISOString(),
  });
  if (securityWrite.error) throw new Error(`Sécurité compte non enregistrée : ${securityWrite.error.message}`);

  const directoryWrite = await userDb.from("admin_user_directory").upsert({
    user_id: userId,
    email: data.email,
    phone: data.phone || null,
    full_name: data.full_name,
    portal: data.portal,
    created_by: actorId,
  }, { onConflict: "user_id" });
  if (directoryWrite.error) throw new Error(`Annuaire admin non enregistré : ${directoryWrite.error.message}`);

  const invitationWrite = await userDb.from("admin_invitations").insert({
    target_user_id: userId,
    target_email: data.email,
    target_phone: data.phone || null,
    portal: data.portal,
    role: roleToInsert,
    invited_by: actorId,
    channel: data.send_via,
    status: "created",
  });
  if (invitationWrite.error) throw new Error(`Invitation non enregistrée : ${invitationWrite.error.message}`);

  const portalLabel = data.portal === "miprojet" ? "MIPROJET" : "MUGEC-CI";
  const portalUrl = data.portal === "miprojet" ? "/miprojet" : "/admin";
  const baseUrl = env("PUBLIC_APP_URL") || "https://mugecci.ivoireprojet.com";
  const loginUrl = `${baseUrl}${portalUrl}`;
  const subject = `Vos accès ${portalLabel} — MUGEC-CI`;
  const text = `Bonjour ${data.full_name},\n\nVotre compte ${portalLabel} (rôle : ${roleToInsert}) a été créé.\n\nIdentifiant : ${data.email}\nMot de passe provisoire : ${password}\n\nConnectez-vous : ${loginUrl}\nÀ votre première connexion, vous serez invité à définir un nouveau mot de passe.\n\n— MUGEC-CI`;

  let delivered: "email" | "whatsapp" | "manual" = "manual";
  try {
    if (data.send_via === "email") {
      const brevoKey = env("BREVO_API_KEY");
      if (brevoKey) {
        const r = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { accept: "application/json", "api-key": brevoKey, "content-type": "application/json" },
          body: JSON.stringify({
            sender: {
              name: env("BREVO_SENDER_NAME") || "MUGEC-CI",
              email: env("BREVO_SENDER_EMAIL") || "no-reply@mugec-ci.ci",
            },
            to: [{ email: data.email, name: data.full_name }],
            subject,
            htmlContent: `<pre style="font-family:Inter,Arial,sans-serif;font-size:14px;line-height:1.6">${text.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" } as any)[c])}</pre>`,
            textContent: text,
          }),
        });
        if (r.ok) delivered = "email";
      }
    } else if (data.send_via === "whatsapp" && data.phone) {
      const url = env("WHATSAPP_API_URL");
      const token = env("WHATSAPP_API_TOKEN");
      if (url && token) {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ messaging_product: "whatsapp", to: data.phone, text: { body: text } }),
        });
        if (r.ok) delivered = "whatsapp";
      }
    }
  } catch (e) {
    console.error("[admin-users] send invitation failed", e);
  }

  return {
    ok: true,
    user_id: userId,
    password_delivered: delivered,
    // Toujours renvoyer le mot de passe au super admin pour transmission hors-bande
    initial_password: password,
  };
}

async function updateAdminUser(input: unknown) {
  const data = z.object({
    user_id: z.string().uuid(),
    new_role: z.string().min(2).max(80).optional(),
    reset_password: z.boolean().optional(),
  }).parse(input);
  const db = admin();
  if (data.new_role) {
    await db.from("user_roles").delete().eq("user_id", data.user_id).neq("role", "membre");
    await db.from("user_roles").insert({ user_id: data.user_id, role: data.new_role as any });
  }
  if (data.reset_password) {
    const newPwd = generatePassword();
    const { error } = await db.auth.admin.updateUserById(data.user_id, { password: newPwd });
    if (error) throw new Error(error.message);
    await db.from("user_security").upsert({
      user_id: data.user_id,
      must_change_password: true,
      password_changed_at: null,
      updated_at: new Date().toISOString(),
    });
    return { ok: true, password: newPwd };
  }
  return { ok: true };
}

async function deleteAdminUser(input: unknown, actorId: string) {
  const data = z.object({ user_id: z.string().uuid() }).parse(input);
  if (data.user_id === actorId) throw new Error("Vous ne pouvez pas supprimer votre propre compte.");
  const db = admin();
  const { error } = await db.auth.admin.deleteUser(data.user_id);
  if (error) throw new Error(error.message);
  await db.from("admin_user_directory").delete().eq("user_id", data.user_id);
  return { ok: true };
}

export default async function handler(request: any, response: any) {
  response.setHeader("content-type", "application/json; charset=utf-8");
  if (request.method !== "POST") {
    return response.status(405).json({ error: "Méthode non autorisée" });
  }
  try {
    const header = request.headers?.authorization || request.headers?.Authorization || "";
    const token = String(header).replace(/^Bearer\s+/i, "");
    if (!token) throw new Error("Authorization manquante. Reconnectez-vous puis réessayez.");
    const actorId = await assertSuperAdmin(token);
    const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
    const { action, data } = z.object({ action: z.string(), data: z.unknown().optional() }).parse(body);
    const result = action === "list" ? await listAdminUsers()
      : action === "create" ? await createAdminUser(data, actorId)
      : action === "update" ? await updateAdminUser(data)
      : action === "delete" ? await deleteAdminUser(data, actorId)
      : null;
    if (!result) return response.status(400).json({ error: `Action inconnue: ${action}` });
    return response.status(200).json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[api/admin-users]", message, stack);
    return response.status(500).json({ error: message, details: stack });
  }
}
