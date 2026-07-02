// Gestion 100% client-side des comptes administrateurs.
// Utilise la session super_admin courante + RLS pour écrire dans
// `user_roles`, `admin_user_directory`, `admin_invitations` et
// `user_security`. La création de compte passe par `auth.signUp` via un
// client Supabase isolé (sans persistence) pour ne pas déconnecter le
// super_admin actuellement connecté.

import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const MUGEC_ROLES = new Set([
  "admin_national", "admin_regional", "admin_local", "agent_saisie",
  "president", "secretaire_general", "tresorier_national", "commissaire_comptes",
  "directeur_executif", "comite_controle", "conseil_sages", "secretaire_regional",
  "tresorier_regional", "delegue_section",
]);

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

function isolatedClient() {
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

function randomPassword() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(36)).join("").slice(0, 18);
}

export async function listAdminUsersClient() {
  const db: any = supabase;
  const [{ data: roles, error: rolesErr }, { data: directory }] = await Promise.all([
    db.from("user_roles").select("user_id, role, created_at"),
    db.from("admin_user_directory").select("user_id, email, phone, full_name, first_name, last_name, address, photo_url, notes, portal, login_identifier, created_at"),
  ]);
  if (rolesErr) throw new Error(`Lecture des rôles : ${rolesErr.message}`);

  const adminRoles = new Set<string>(["super_admin", "miprojet_admin", "miprojet_viewer", ...Array.from(MUGEC_ROLES)]);
  const grouped = new Map<string, { id: string; roles: string[]; created_at: string }>();
  for (const r of roles ?? []) {
    if (!adminRoles.has(String(r.role))) continue;
    const cur = grouped.get(r.user_id) ?? { id: r.user_id, roles: [] as string[], created_at: r.created_at };
    cur.roles.push(String(r.role));
    grouped.set(r.user_id, cur);
  }
  const directoryMap = new Map<string, any>();
  for (const d of directory ?? []) directoryMap.set(d.user_id, d);

  return {
    users: Array.from(grouped.values()).map((g) => {
      const d = directoryMap.get(g.id);
      return {
        id: g.id,
        email: d?.email ?? "—",
        phone: d?.phone ?? null,
        full_name: d?.full_name ?? null,
        first_name: d?.first_name ?? null,
        last_name: d?.last_name ?? null,
        address: d?.address ?? null,
        photo_url: d?.photo_url ?? null,
        notes: d?.notes ?? null,
        portal: d?.portal ?? null,
        login_identifier: d?.login_identifier ?? null,
        created_at: g.created_at,
        last_sign_in_at: null,
        roles: g.roles,
      };
    }),
  };
}

export type CreateAdminUserInput = {
  email: string;
  phone?: string | null;
  full_name: string;
  portal: "mugec" | "miprojet";
  role: string;
  password?: string;
  send_via?: "email" | "whatsapp";
  login_identifier?: string | null;
};

const IGNORABLE_SIGNUP = /already registered|already exists|user already|sending confirmation|confirmation email|sending email|smtp|email rate limit|email_send_failure/i;

export async function createAdminUserClient(input: CreateAdminUserInput) {
  if (!input.email || !input.full_name) throw new Error("Email et nom complet requis.");
  if (input.portal === "mugec" && !MUGEC_ROLES.has(input.role)) throw new Error("Rôle MUGEC-CI invalide.");
  if (input.portal === "miprojet" && !["super_admin", "miprojet_admin", "miprojet_viewer"].includes(input.role)) {
    throw new Error("Rôle MIPROJET invalide.");
  }

  const { data: actor } = await supabase.auth.getUser();
  if (!actor.user) throw new Error("Session expirée. Reconnectez-vous.");

  const password = input.password && input.password.length >= 6 ? input.password : randomPassword();

  const iso = isolatedClient();
  const { data: signed, error: signErr } = await iso.auth.signUp({
    email: input.email,
    password,
    phone: input.phone || undefined,
    options: {
      data: { full_name: input.full_name, created_by_super_admin: true },
      emailRedirectTo: `${window.location.origin}${input.portal === "miprojet" ? "/miprojet" : "/admin"}`,
    },
  });
  if (signErr && !IGNORABLE_SIGNUP.test(signErr.message)) {
    throw new Error(`Création refusée : ${signErr.message}`);
  }

  let userId = signed?.user?.id ?? null;
  const db: any = supabase;
  if (!userId) {
    const { data: existing } = await db
      .from("admin_user_directory").select("user_id").eq("email", input.email).maybeSingle();
    userId = existing?.user_id ?? null;
  }
  if (!userId) {
    // Le SMTP Supabase a échoué (envoi confirmation) mais le compte a probablement
    // été créé. On le retrouve via un RPC SECURITY DEFINER (réservé super_admin).
    const { data: fetched } = await db.rpc("admin_lookup_user_id_by_email", { p_email: input.email });
    if (typeof fetched === "string") userId = fetched;
  }
  if (!userId) {
    throw new Error(
      "Compte créé côté Supabase mais identifiant introuvable. Ouvrez Supabase → Auth → Users pour vérifier, ou demandez à l'utilisateur de se connecter une fois pour finaliser.",
    );
  }

  const roleWrite = await db
    .from("user_roles")
    .upsert({ user_id: userId, role: input.role }, { onConflict: "user_id,role", ignoreDuplicates: true });
  if (roleWrite.error) throw new Error(`Rôle non assigné : ${roleWrite.error.message}`);

  await db.from("user_security").upsert({
    user_id: userId,
    must_change_password: true,
    password_changed_at: null,
    updated_at: new Date().toISOString(),
  });

  await db.from("admin_user_directory").upsert(
    {
      user_id: userId,
      email: input.email,
      phone: input.phone || null,
      full_name: input.full_name,
      portal: input.portal,
      login_identifier: input.login_identifier?.trim() || null,
      created_by: actor.user.id,
    },
    { onConflict: "user_id" },
  );

  await db.from("admin_invitations").insert({
    target_user_id: userId,
    target_email: input.email,
    target_phone: input.phone || null,
    portal: input.portal,
    role: input.role,
    invited_by: actor.user.id,
    channel: input.send_via ?? "email",
    status: "created",
  });

  // Envoi Brevo direct depuis le navigateur (clé publique CORS n'est pas
  // exposée : on passe par un endpoint public Brevo qui accepte le header
  // api-key). Si BREVO_API_KEY n'est pas exposée côté client, on n'échoue pas :
  // le mot de passe est de toute façon retourné pour transmission manuelle.
  let deliveredEmail: "email" | "manual" = "manual";
  if ((input.send_via ?? "email") === "email") {
    try {
      const sent = await sendInvitationEmailViaBrevo({
        to_email: input.email,
        to_name: input.full_name,
        portal: input.portal,
        role: input.role,
        login_identifier: input.login_identifier?.trim() || input.email,
        password,
      });
      if (sent) deliveredEmail = "email";
    } catch (e) { console.warn("brevo send failed", e); }
  }

  return {
    ok: true as const,
    user_id: userId,
    initial_password: password,
    password_delivered: deliveredEmail,
  };
}

// ---- Envoi d'email d'invitation (Brevo direct via server function) ----
async function sendInvitationEmailViaBrevo(payload: {
  to_email: string;
  to_name: string;
  portal: "mugec" | "miprojet";
  role: string;
  login_identifier: string;
  password: string;
}): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return false;
  try {
    const r = await fetch("/api/send-admin-invitation", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(payload),
    });
    return r.ok;
  } catch { return false; }
}

// ---- Message WhatsApp prêt-à-envoyer ----
export function buildWhatsAppInvitationMessage(opts: {
  full_name: string;
  portal: "mugec" | "miprojet";
  role: string;
  login_identifier: string;
  password: string;
}) {
  const portalLabel = opts.portal === "miprojet" ? "MIPROJET" : "MUGEC-CI";
  const url = opts.portal === "miprojet"
    ? "https://mugecci.ivoireprojet.com/miprojet"
    : "https://mugecci.ivoireprojet.com/admin";
  return (
    `👋 Bonjour ${opts.full_name},\n\n` +
    `Votre compte *${portalLabel}* vient d'être créé par MIPROJET pour la MUGEC-CI.\n\n` +
    `🧩 *Rôle* : ${opts.role}\n` +
    `👤 *Identifiant* : ${opts.login_identifier}\n` +
    `🔑 *Mot de passe provisoire* : ${opts.password}\n\n` +
    `🔗 Connectez-vous ici : ${url}\n\n` +
    `⚠️ Ce mot de passe est à changer dès la première connexion.\n` +
    `— L'équipe MIPROJET`
  );
}

export function buildWhatsAppLink(phone: string | null | undefined, message: string) {
  const digits = (phone ?? "").replace(/\D+/g, "");
  const encoded = encodeURIComponent(message);
  return digits ? `https://wa.me/${digits}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

export type UpdateAdminProfileInput = {
  user_id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string;
  email?: string;
  phone?: string | null;
  address?: string | null;
  photo_url?: string | null;
  notes?: string | null;
};

export async function updateAdminProfileClient(input: UpdateAdminProfileInput) {
  const db: any = supabase;
  const patch: any = { updated_at: new Date().toISOString() };
  if (input.first_name !== undefined) patch.first_name = input.first_name;
  if (input.last_name !== undefined) patch.last_name = input.last_name;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.address !== undefined) patch.address = input.address;
  if (input.photo_url !== undefined) patch.photo_url = input.photo_url;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.email !== undefined) patch.email = input.email;
  if (input.full_name !== undefined) patch.full_name = input.full_name;
  else if (input.first_name !== undefined || input.last_name !== undefined) {
    patch.full_name = `${input.first_name ?? ""} ${input.last_name ?? ""}`.trim() || "Sans nom";
  }
  const { error } = await db
    .from("admin_user_directory")
    .update(patch)
    .eq("user_id", input.user_id);
  if (error) throw new Error(`Mise à jour profil : ${error.message}`);
  return { ok: true as const };
}

export async function uploadAdminPhotoClient(userId: string, file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  if (["svg"].includes(ext)) throw new Error("Format SVG interdit.");
  const path = `admins/${userId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(`Upload photo : ${error.message}`);
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? path;
}

export async function updateAdminUserRoleClient(userId: string, newRole: string) {
  const db: any = supabase;
  const removed = await db.from("user_roles").delete().eq("user_id", userId).neq("role", "membre");
  if (removed.error) throw new Error(`Révocation des rôles : ${removed.error.message}`);
  const inserted = await db.from("user_roles").insert({ user_id: userId, role: newRole });
  if (inserted.error) throw new Error(`Nouveau rôle : ${inserted.error.message}`);
  return { ok: true as const };
}

export async function resetAdminPasswordClient(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw new Error(`Email de réinitialisation : ${error.message}`);
  return { ok: true as const };
}

export async function deleteAdminUserClient(userId: string) {
  const { data: actor } = await supabase.auth.getUser();
  if (!actor.user) throw new Error("Session expirée.");
  if (actor.user.id === userId) throw new Error("Vous ne pouvez pas supprimer votre propre compte.");

  const db: any = supabase;
  const roles = await db.from("user_roles").delete().eq("user_id", userId).neq("role", "membre");
  if (roles.error) throw new Error(`Révocation des rôles : ${roles.error.message}`);
  const directory = await db.from("admin_user_directory").delete().eq("user_id", userId);
  if (directory.error) throw new Error(`Retrait annuaire : ${directory.error.message}`);
  return { ok: true as const };
}

// ---- Permissions ----

export type PermissionDef = {
  key: string;
  label: string;
  description: string | null;
  category: string;
  portal: string;
};

export async function listPermissionsAndRolesClient() {
  const db: any = supabase;
  const [{ data: catalog, error: cErr }, { data: grants, error: gErr }] = await Promise.all([
    db.from("permission_catalog").select("*").order("category").order("label"),
    db.from("role_permissions").select("role, permission_key, allowed"),
  ]);
  if (cErr) throw new Error(`Catalogue permissions : ${cErr.message}`);
  if (gErr) throw new Error(`Lecture permissions : ${gErr.message}`);
  return {
    catalog: (catalog ?? []) as PermissionDef[],
    grants: (grants ?? []) as { role: string; permission_key: string; allowed: boolean }[],
  };
}

export async function setRolePermissionClient(role: string, permissionKey: string, allowed: boolean) {
  const db: any = supabase;
  const { error } = await db
    .from("role_permissions")
    .upsert(
      { role, permission_key: permissionKey, allowed, updated_at: new Date().toISOString() },
      { onConflict: "role,permission_key" },
    );
  if (error) throw new Error(`Mise à jour permission : ${error.message}`);
  return { ok: true as const };
}
