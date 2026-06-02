import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const ADMIN_ROLES = new Set([
  "super_admin", "admin_national", "admin_regional", "admin_local", "agent_saisie",
  "president", "secretaire_general", "tresorier_national", "commissaire_comptes",
  "directeur_executif", "comite_controle", "conseil_sages", "secretaire_regional",
  "tresorier_regional", "delegue_section",
]);

const SAFE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

const env = (name: string) => process.env[name] || "";
const SUPABASE_URL = env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY") || env("SERVICE_ROLE_KEY");
const PUBLISHABLE_KEY = env("SUPABASE_PUBLISHABLE_KEY") || env("VITE_SUPABASE_PUBLISHABLE_KEY");

const admin = SUPABASE_URL && SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const authed = (token: string) => SUPABASE_URL && PUBLISHABLE_KEY
  ? createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

function json(status: number, payload: unknown) {
  return { status, payload };
}

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

async function assertAdmin(token: string) {
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY non configurée sur Vercel");
  const client = authed(token);
  if (!client) throw new Error("Variables Supabase publiques non configurées sur Vercel");
  const { data: userRes, error: userError } = await client.auth.getUser(token);
  if (userError || !userRes.user) throw new Error("Session invalide ou expirée");
  const { data, error } = await admin.from("user_roles").select("role").eq("user_id", userRes.user.id);
  if (error) throw new Error(error.message);
  const ok = (data ?? []).some((r: any) => ADMIN_ROLES.has(String(r.role)));
  if (!ok) throw new Error("Accès refusé");
  return userRes.user.id;
}

async function callGateway(messages: any[], model = "google/gemini-3-flash-preview") {
  const key = env("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY non configurée sur Vercel");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, temperature: 0.7 }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Limite IA atteinte, réessayez dans un instant.");
    if (res.status === 402) throw new Error("Crédits IA épuisés. Rechargez votre espace Lovable.");
    throw new Error(`Erreur IA ${res.status}: ${body.slice(0, 500) || "réponse vide"}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function generateArticle(input: unknown) {
  const data = z.object({
    topic: z.string().trim().min(2).max(500),
    kind: z.enum(["actualite", "opportunite"]).default("actualite"),
  }).parse(input);
  const kindLabel = data.kind === "actualite" ? "actualité" : "opportunité";
  const raw = await callGateway([
    { role: "system", content: `Tu es l'éditeur officiel de MUGEC-CI. Rédige une ${kindLabel} professionnelle en français, structurée en HTML. Réponds STRICTEMENT en JSON valide.` },
    { role: "user", content: `Sujet / brief : "${data.topic}"

Produis un JSON avec EXACTEMENT ces champs :
{"title":"titre clair max 80 caractères","summary":"résumé 2-3 phrases max 280 caractères","body":"<contenu HTML complet 500-900 mots>","category":"Annonces | Vie de la mutuelle | Partenariats | Formation | Emploi | Marché public","tags":["3 à 6 mots-clés"],"meta_title":"titre SEO max 60 caractères","meta_description":"meta description SEO max 155 caractères","image_prompt":"description anglaise sans texte"}
Aucune autre clé, JSON pur.` },
  ]);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Réponse IA invalide: ${raw.slice(0, 500)}`);
  let parsed: any;
  try { parsed = JSON.parse(match[0]); } catch { throw new Error(`Réponse IA non parsable: ${raw.slice(0, 500)}`); }
  return {
    title: String(parsed.title ?? "").slice(0, 200),
    summary: String(parsed.summary ?? "").slice(0, 500),
    body: String(parsed.body ?? ""),
    category: String(parsed.category ?? ""),
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).slice(0, 8) : [],
    meta_title: String(parsed.meta_title ?? "").slice(0, 70),
    meta_description: String(parsed.meta_description ?? "").slice(0, 180),
    image_prompt: String(parsed.image_prompt ?? data.topic),
    slug: slugify(parsed.title ?? data.topic),
  };
}

async function generateImageDataUrl(prompt: string) {
  const key = env("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY non configurée sur Vercel");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      prompt: `Editorial photography, professional, clean. ${prompt}. No text, no watermark.`,
      modalities: ["image", "text"],
      messages: [{ role: "user", content: `Editorial professional photo: ${prompt}. No text.` }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Erreur image ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json
    ?? data?.choices?.[0]?.message?.images?.[0]?.image_url?.url?.replace(/^data:image\/[^;]+;base64,/, "")
    ?? data?.choices?.[0]?.message?.content?.match?.(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/)?.[1];
  if (!b64) throw new Error(`Image non générée: ${JSON.stringify(data).slice(0, 500)}`);
  return `data:image/png;base64,${b64}`;
}

async function uploadDataUrl(dataUrl: string, folder: string) {
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY non configurée sur Vercel");
  const m = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!m) throw new Error("Image invalide");
  const mime = m[1].toLowerCase();
  if (!SAFE_IMAGE_TYPES.has(mime)) throw new Error("Type d'image non autorisé");
  const ext = mime.split("/")[1] || "png";
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await admin.storage.from("content").upload(path, Buffer.from(m[2], "base64"), { contentType: mime, upsert: false });
  if (error) throw new Error(error.message);
  const { data } = admin.storage.from("content").getPublicUrl(path);
  return data.publicUrl;
}

async function generateArticleImages(input: unknown) {
  const data = z.object({
    prompt: z.string().trim().min(2).max(1000),
    mode: z.enum(["cover", "illustrations"]),
    count: z.number().int().min(1).max(3).default(1),
    folder: z.enum(["actualites", "opportunites"]).default("actualites"),
  }).parse(input);
  const n = data.mode === "cover" ? 1 : Math.min(3, data.count);
  const urls: string[] = [];
  for (let i = 0; i < n; i++) urls.push(await uploadDataUrl(await generateImageDataUrl(n === 1 ? data.prompt : `${data.prompt} — vue ${i + 1}`), data.folder));
  return { urls };
}

const newsSchema = z.object({
  id: z.string().uuid().optional(), title: z.string().trim().min(2).max(200), slug: z.string().trim().max(120).optional().nullable(),
  summary: z.string().max(500).optional().nullable(), body: z.string().min(2), cover_url: z.string().max(500).optional().nullable(),
  illustrations: z.array(z.string()).optional().default([]), category: z.string().max(80).optional().nullable(), tags: z.array(z.string().max(40)).max(10).optional().default([]),
  meta_title: z.string().max(120).optional().nullable(), meta_description: z.string().max(300).optional().nullable(), published: z.boolean().default(true),
});

const oppSchema = z.object({
  id: z.string().uuid().optional(), title: z.string().trim().min(2).max(200), slug: z.string().trim().max(120).optional().nullable(),
  summary: z.string().max(500).optional().nullable(), description: z.string().min(2), body: z.string().optional().nullable(), cover_url: z.string().max(500).optional().nullable(),
  illustrations: z.array(z.string()).optional().default([]), type: z.string().max(80).optional().nullable(), category: z.string().max(80).optional().nullable(), tags: z.array(z.string().max(40)).max(10).optional().default([]),
  lieu: z.string().max(150).optional().nullable(), date_limite: z.string().optional().nullable(), meta_title: z.string().max(120).optional().nullable(), meta_description: z.string().max(300).optional().nullable(), published: z.boolean().default(true),
});

async function upsertNews(input: unknown, userId: string) {
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY non configurée sur Vercel");
  const data = newsSchema.parse(input);
  const payload = { ...data, id: undefined, slug: data.slug || slugify(data.title), author_id: userId };
  if (data.id) { const { error } = await admin.from("news").update(payload).eq("id", data.id); if (error) throw new Error(error.message); return { ok: true, id: data.id }; }
  const { data: row, error } = await admin.from("news").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  return { ok: true, id: row.id };
}

async function upsertOpportunite(input: unknown) {
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY non configurée sur Vercel");
  const data = oppSchema.parse(input);
  const payload = { ...data, id: undefined, slug: data.slug || slugify(data.title), body: data.body || data.description, type: data.type || data.category || null };
  if (data.id) { const { error } = await admin.from("opportunites").update(payload).eq("id", data.id); if (error) throw new Error(error.message); return { ok: true, id: data.id }; }
  const { data: row, error } = await admin.from("opportunites").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  return { ok: true, id: row.id };
}

async function deleteContent(input: unknown) {
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY non configurée sur Vercel");
  const data = z.object({ id: z.string().uuid(), kind: z.enum(["news", "opportunites"]) }).parse(input);
  const { error } = await admin.from(data.kind).delete().eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export default async function handler(request: any, response: any) {
  response.setHeader("content-type", "application/json; charset=utf-8");
  if (request.method !== "POST") {
    const out = json(405, { error: "Méthode non autorisée" });
    return response.status(out.status).json(out.payload);
  }
  try {
    const header = request.headers?.authorization || request.headers?.Authorization || "";
    const token = String(header).replace(/^Bearer\s+/i, "");
    const userId = await assertAdmin(token);
    const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
    const { action, data } = z.object({ action: z.string(), data: z.unknown() }).parse(body);
    const result = action === "generateArticle" ? await generateArticle(data)
      : action === "generateArticleImages" ? await generateArticleImages(data)
      : action === "upsertNews" ? await upsertNews(data, userId)
      : action === "upsertOpportunite" ? await upsertOpportunite(data)
      : action === "deleteContent" ? await deleteContent(data)
      : null;
    if (!result) {
      const out = json(400, { error: `Action inconnue: ${action}` });
      return response.status(out.status).json(out.payload);
    }
    const out = json(200, { result });
    return response.status(out.status).json(out.payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[api/ai-editor]", message, stack);
    const out = json(500, { error: message, details: stack });
    return response.status(out.status).json(out.payload);
  }
}