import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { mcpError, mcpJson, supabaseForMcpUser } from "../supabase";

export default defineTool({
  name: "list_opportunities",
  title: "Lister les opportunités MUGEC-CI",
  description: "Retourne les opportunités visibles par l'utilisateur authentifié, via les règles RLS Supabase.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("Nombre maximum d'opportunités à retourner."),
    type: z.string().optional().describe("Filtre optionnel sur le type (Emploi, Formation, Marché public...)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, type }, ctx) => {
    let supabase: any;
    try {
      supabase = supabaseForMcpUser(ctx);
    } catch (error) {
      return mcpError(error instanceof Error ? error.message : "Authentification requise.");
    }
    let q = supabase
      .from("opportunites")
      .select("id,title,summary,slug,type,category,lieu,date_limite,cover_url,tags")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (type) q = q.eq("type", type);
    const { data, error } = await q;
    if (error) {
      return mcpError(`Erreur: ${error.message}`);
    }
    return mcpJson({ items: data ?? [] });
  },
});
