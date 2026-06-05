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
  // Client sans persistence pour ne pas écraser la session du super_admin.
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
    db.from("admin_user_directory").select("user_id, email, phone, full_name, portal, created_at"),
  ]);
  if (rolesErr) throw new Error(`Lecture des rôles : ${rolesErr.message}`);

  const adminRoles = new Set(["super_admin", "miprojet_admin", "miprojet_viewer", ...Array.from(MUGEC_ROLES)]);
  const grouped = new Map<string, { id: string; roles: string[]; created_at: string }>();
  for (const r of roles ?? []) {
    if (!adminRoles.has(String(r.role))) continue;
    const cur = grouped.get(r.user_id) ?? { id: r.user_id, roles: [], created_at: r.created_at };
    cur.roles.push(String(r.role));
    grouped.set(r.user_id, cur);
  }
  const directoryMap = new Map<string, any>();
  for (const d of directory ?? []) directoryMap.set(d.user_id, d);

  return {
    users: Array.from(grouped.values()).map((g) => ({
      id: g.id,
      email: directoryMap.get(g.id)?.email ?? "—",
      phone: directoryMap.get(g.id)?.phone ?? null,
      full_name: directoryMap.get(g.id)?.full_name ?? null,
      portal: directoryMap.get(g.id)?.portal ?? null,
      created_at: g.created_at,
      last_sign_in_at: null,
      roles: g.roles,
    })),
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
};

export async function createAdminUserClient(input: CreateAdminUserInput) {
  if (!input.email || !input.full_name) throw new Error("Email et nom complet requis.");

  if (input.portal === "mugec" && !MUGEC_ROLES.has(input.role)) {
    throw new Error("Rôle MUGEC-CI invalide.");
  }
  if (input.portal === "miprojet" && !["super_admin", "miprojet_admin", "miprojet_viewer"].includes(input.role)) {
    throw new Error("Rôle MIPROJET invalide.");
  }

  const { data: actor } = await supabase.auth.getUser();
  if (!actor.user) throw new Error("Session expirée. Reconnectez-vous.");

  const password = input.password && input.password.length >= 6 ? input.password : randomPassword();

  // 1. Création du compte via un client isolé (ne touche pas la session courante)
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
  if (signErr && !/already registered|already exists|user already/i.test(signErr.message)) {
    throw new Error(`Création refusée : ${signErr.message}`);
  }

  let userId = signed?.user?.id ?? null;
  if (!userId) {
    // Compte déjà existant : on tente de retrouver l'id via la table directory.
    const { data: existing } = await (supabase as any)
      .from("admin_user_directory")
      .select("user_id")
      .eq("email", input.email)
      .maybeSingle();
    userId = existing?.user_id ?? null;
  }
  if (!userId) {
    throw new Error("Compte créé mais identifiant introuvable. Demandez à l'utilisateur de se connecter une fois pour finaliser l'attribution du rôle.");
  }

  // 2. Assignation du rôle (RLS : super_admin only)
  const db: any = supabase;
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

  return {
    ok: true as const,
    user_id: userId,
    initial_password: password,
    password_delivered: "manual" as const,
  };
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
