import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "list_opportunities",
  title: "Lister les opportunités MUGEC-CI",
  description: "Retourne les opportunités publiées (emploi, formation, marché) avec date limite.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("Nombre maximum d'opportunités à retourner."),
    type: z.string().optional().describe("Filtre optionnel sur le type (Emploi, Formation, Marché public...)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, type }) => {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let q = supabase
      .from("opportunites")
      .select("id,title,summary,slug,type,category,lieu,date_limite,cover_url,tags")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (type) q = q.eq("type", type);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: `Erreur: ${error.message}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { items: data ?? [] },
    };
  },
});
