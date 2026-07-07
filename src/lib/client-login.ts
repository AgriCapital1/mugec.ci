import { supabase } from "@/lib/supabase";
import { loginWithIdentifier } from "@/lib/login.functions";

export type Portal = "member" | "admin" | "miprojet";

export type LoginResult =
  | { ok: true; dashboard_path: string }
  | { ok: false; error: "invalid_credentials" };

const MUGEC_ADMIN_ROLES = new Set([
  "admin_national",
  "admin_regional",
  "admin_local",
  "agent_saisie",
  "president",
  "secretaire_general",
  "tresorier_national",
  "commissaire_comptes",
  "directeur_executif",
  "comite_controle",
  "conseil_sages",
  "secretaire_regional",
  "tresorier_regional",
  "delegue_section",
]);

/**
 * Connexion 100% côté client — fonctionne sur n'importe quel hébergeur
 * statique (Vercel, OVH, Netlify…), aucun runtime serveur requis.
 *
 * - resolve_login_email : RPC SECURITY DEFINER exposée à `anon` (retourne uniquement un email).
 * - signInWithPassword : authentification Supabase standard.
 * - dashboard_path déduit côté client à partir des rôles.
 */
export async function loginClientSide(
  identifier: string,
  password: string,
  portal: Portal,
): Promise<LoginResult> {
  const generic: LoginResult = { ok: false, error: "invalid_credentials" };
  const id = identifier.trim().toLowerCase();
  if (id.length < 3 || password.length === 0) return generic;

  try {
    const serverResult = await loginWithIdentifier({ data: { identifier: id, password, portal } });
    if (serverResult?.ok && serverResult.access_token && serverResult.refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token: serverResult.access_token,
        refresh_token: serverResult.refresh_token,
      });
      if (!error) return { ok: true, dashboard_path: serverResult.dashboard_path };
    }
  } catch {
    // Fallback direct ci-dessous pour les hébergements qui bloquent les server functions.
  }

  const { data: email, error: rpcErr } = await supabase.rpc("resolve_login_email", {
    p_identifier: id,
  });
  if (rpcErr || typeof email !== "string" || email.length === 0) return generic;

  const { data: signIn, error: signErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signErr || !signIn.user || !signIn.session) return generic;

  const { data: roles, error: rolesErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", signIn.user.id);
  if (rolesErr) {
    await supabase.auth.signOut();
    return generic;
  }
  const roleList = (roles ?? []).map((r) => String(r.role));
  const isSuper = roleList.includes("super_admin");
  const isAdmin = isSuper || roleList.some((r) => MUGEC_ADMIN_ROLES.has(r));

  let target: string;
  if (isSuper) target = "/admin/miprojet";
  else if (isAdmin) target = "/admin";
  else target = "/membre";

  if (portal === "member" && target !== "/membre") {
    await supabase.auth.signOut();
    return generic;
  }
  if (portal === "admin" && target !== "/admin" && !isSuper) {
    await supabase.auth.signOut();
    return generic;
  }
  if (portal === "miprojet" && target !== "/admin/miprojet") {
    await supabase.auth.signOut();
    return generic;
  }

  const dashboard_path = target === "/admin/miprojet" ? (portal === "admin" ? "/admin" : "/miprojet") : target;
  return { ok: true, dashboard_path };
}
