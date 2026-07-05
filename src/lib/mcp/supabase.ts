import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

const ADMIN_ROLES = new Set([
  "super_admin",
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

export function supabaseForMcpUser(ctx: ToolContext) {
  const token = ctx.getToken();
  if (!token || !ctx.isAuthenticated()) {
    throw new Error("Authentification requise pour utiliser cet outil MCP.");
  }

  const url = process.env.SUPABASE_URL ?? import.meta.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Configuration Supabase manquante côté serveur.");

  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  }) as any;
}

export async function assertMcpAdmin(supabase: any, userId: string | undefined) {
  if (!userId) throw new Error("Utilisateur MCP introuvable.");
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(`Lecture des rôles refusée par RLS : ${error.message}`);
  const ok = (data ?? []).some((row: { role: unknown }) => ADMIN_ROLES.has(String(row.role)));
  if (!ok) throw new Error("Rôle administrateur requis pour cet outil MCP.");
}

export function mcpError(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export function mcpJson(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data as Record<string, unknown>,
  };
}