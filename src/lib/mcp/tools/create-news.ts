import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { assertMcpAdmin, mcpError, mcpJson, supabaseForMcpUser } from "../supabase";

const SAFE_IMAGE_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

async function uploadCover(supabase: any, dataUrl: string, filename?: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) throw new Error("Image data URL invalide.");
  const mime = match[1].toLowerCase();
  if (!SAFE_IMAGE_MIME.has(mime)) throw new Error("Format image refusé. SVG et formats actifs interdits.");
  const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("Image trop volumineuse pour MCP (max 5 Mo)." );
  const ext = mime.split("/")[1] || "png";
  const safeName = (filename ?? `actualite.${ext}`).replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80);
  const path = `actualites/mcp-${Date.now()}-${safeName.endsWith(`.${ext}`) ? safeName : `${safeName}.${ext}`}`;
  const { error } = await supabase.storage.from("content").upload(path, bytes, {
    contentType: mime,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("content").getPublicUrl(path);
  return data.publicUrl as string;
}

export default defineTool({
  name: "create_news",
  title: "Créer une actualité MUGEC-CI",
  description: "Crée une actualité avec titre, description et image optionnelle, en agissant comme l'utilisateur authentifié via RLS.",
  inputSchema: {
    title: z.string().trim().min(2).max(200).describe("Titre de l'actualité."),
    description: z.string().trim().min(2).max(500).describe("Résumé ou description courte."),
    content_html: z.string().trim().min(2).max(30000).optional().describe("Contenu HTML complet optionnel."),
    category: z.string().trim().max(80).optional().describe("Catégorie éditoriale optionnelle."),
    tags: z.array(z.string().trim().min(1).max(40)).max(10).optional().describe("Mots-clés optionnels."),
    published: z.boolean().default(false).describe("Publier immédiatement ou conserver en brouillon."),
    cover_image_data_url: z.string().optional().describe("Image de couverture en data URL base64. SVG interdit."),
    cover_image_filename: z.string().max(120).optional().describe("Nom du fichier image optionnel."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    let supabase: any;
    try {
      supabase = supabaseForMcpUser(ctx);
      await assertMcpAdmin(supabase, ctx.getUserId());

      const coverUrl = input.cover_image_data_url
        ? await uploadCover(supabase, input.cover_image_data_url, input.cover_image_filename)
        : null;

      const payload = {
        title: input.title,
        slug: slugify(input.title),
        summary: input.description,
        body: input.content_html || `<p>${input.description.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!)}</p>`,
        cover_url: coverUrl,
        image_url: coverUrl,
        category: input.category || null,
        tags: input.tags ?? [],
        published: input.published,
        status: input.published ? "published" : "draft",
        published_at: input.published ? new Date().toISOString() : null,
        author_id: ctx.getUserId(),
      };

      const { data, error } = await supabase.from("news").insert(payload).select("id,title,slug,published,status,cover_url,created_at").single();
      if (error) return mcpError(`Création refusée par Supabase/RLS : ${error.message}`);
      return mcpJson({ row: data });
    } catch (error) {
      return mcpError(error instanceof Error ? error.message : "Erreur inconnue lors de la création.");
    }
  },
});