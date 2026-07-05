import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { mcpError, mcpJson, supabaseForMcpUser } from "../supabase";

export default defineTool({
  name: "list_news",
  title: "Lister les actualités MUGEC-CI",
  description: "Retourne les actualités visibles par l'utilisateur authentifié, via les règles RLS Supabase.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("Nombre maximum d'articles à retourner."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    let supabase: any;
    try {
      supabase = supabaseForMcpUser(ctx);
    } catch (error) {
      return mcpError(error instanceof Error ? error.message : "Authentification requise.");
    }
    const { data, error } = await supabase
      .from("news")
      .select("id,title,summary,slug,published_at,image_url,category,tags")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) {
      return mcpError(`Erreur: ${error.message}`);
    }
    return mcpJson({ items: data ?? [] });
  },
});
