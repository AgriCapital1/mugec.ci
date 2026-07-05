import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "list_news",
  title: "Lister les actualités MUGEC-CI",
  description: "Retourne les actualités publiées (titre, résumé, date, URL).",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("Nombre maximum d'articles à retourner."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }) => {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("news")
      .select("id,title,summary,slug,published_at,image_url,category,tags")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) {
      return { content: [{ type: "text", text: `Erreur: ${error.message}` }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { items: data ?? [] },
    };
  },
});
