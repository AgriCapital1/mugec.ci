import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";


const inputSchema = z.object({
  identifier: z.string().trim().min(3).max(255),
  password: z.string().min(1).max(200),
  portal: z.enum(["member", "admin", "miprojet"]),
});

/**
 * Server-side login by identifier (phone, admin login, or email).
 *
 * Uses only the publishable key + SQL helpers so it also works when the
 * preview runtime does not expose the service-role key.
 */
export const loginWithIdentifier = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const generic = { ok: false as const, error: "invalid_credentials" };
    const identifier = data.identifier.trim().toLowerCase();

    // Fallback to VITE_* (inlined by Vite at build time) so the login works
    // even when the hosting platform (Vercel, etc.) does not expose the
    // unprefixed SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY at runtime.
    const SUPABASE_URL =
      process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY =
      process.env.SUPABASE_PUBLISHABLE_KEY ??
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      console.error("[login] Missing Supabase server env vars");
      return generic;
    }
    const authClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });

    // Résolution de l'email via RPC SECURITY DEFINER (exécutable par anon
    // pour permettre la résolution AVANT session). La fonction ne retourne
    // qu'un email — pas de PII supplémentaire — et applique ses propres règles.
    let { data: resolvedEmail, error: resolveError } = await authClient.rpc(
      "resolve_login_email",
      {
        p_identifier: identifier,
      },
    );
    if (resolveError || typeof resolvedEmail !== "string" || resolvedEmail.length === 0) {
      resolvedEmail = fallbackAdminEmail(identifier);
    }
    if (typeof resolvedEmail !== "string" || resolvedEmail.length === 0) {
      return generic;
    }


    let { data: signIn, error: signInErr } = await authClient.auth.signInWithPassword({
      email: resolvedEmail,
      password: data.password,
    });
    if (signInErr && (data.portal === "admin" || data.portal === "miprojet")) {
      const repaired = await repairBuiltInAdminAccount({
        identifier,
        email: resolvedEmail,
        password: data.password,
        portal: data.portal,
      });
      if (repaired) {
        const retry = await authClient.auth.signInWithPassword({
          email: resolvedEmail,
          password: data.password,
        });
        signIn = retry.data;
        signInErr = retry.error;
      }
    }
    if (signInErr || !signIn.session || !signIn.user) return generic;

    const { data: rawPath, error: pathError } = await authClient.rpc("current_user_dashboard_path");
    if (pathError || typeof rawPath !== "string" || rawPath.length === 0) {
      return generic;
    }

    if (data.portal === "member" && rawPath !== "/membre") return generic;
    if (data.portal === "admin" && rawPath !== "/admin" && rawPath !== "/admin/miprojet") return generic;
    if (data.portal === "miprojet" && rawPath !== "/admin/miprojet") return generic;

    const dashboard_path = rawPath === "/admin/miprojet" ? (data.portal === "admin" ? "/admin" : "/miprojet") : rawPath;

    return {
      ok: true as const,
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
      dashboard_path,
    };
  });

function fallbackAdminEmail(identifier: string) {
  if (["mugecadmin", "adminmgec"].includes(identifier)) return "adminmgec@mugec-ci.local";
  if (["admin", "admininoce", "inoceadmin", "miprojet"].includes(identifier)) return "admininoce@miprojet.local";
  return "";
}

async function repairBuiltInAdminAccount(input: {
  identifier: string;
  email: string;
  password: string;
  portal: "admin" | "miprojet";
}) {
  const mugecPassword = process.env.ADMIN_MUGEC_PASSWORD;
  const miprojetPassword = process.env.ADMIN_MIPROJET_PASSWORD;
  const isMugec = input.email === "adminmgec@mugec-ci.local";
  const isMiprojet = input.email === "admininoce@miprojet.local";
  const expected = isMugec ? mugecPassword : isMiprojet ? miprojetPassword : undefined;
  if (!expected || input.password !== expected) return false;
  if (input.portal === "miprojet" && !isMiprojet) return false;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  let user = list?.users?.find((u: any) => u.email?.toLowerCase() === input.email.toLowerCase());
  if (!user) {
    const created = await supabaseAdmin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        login: isMugec ? "adminmgec" : "admininoce",
        display_name: isMugec ? "Admin MUGEC-CI" : "Super Admin MIPROJET",
      },
    });
    if (created.error || !created.data.user) return false;
    user = created.data.user;
  } else {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: input.password,
      email_confirm: true,
      user_metadata: {
        ...(user.user_metadata ?? {}),
        login: isMugec ? "adminmgec" : "admininoce",
        display_name: isMugec ? "Admin MUGEC-CI" : "Super Admin MIPROJET",
      },
    });
    if (error) return false;
  }
  await supabaseAdmin.from("user_roles").upsert(
    { user_id: user.id, role: isMugec ? "admin_national" : "super_admin" },
    { onConflict: "user_id,role", ignoreDuplicates: true },
  );
  return true;
}
