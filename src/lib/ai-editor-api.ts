import { supabase } from "@/lib/supabase";

type AiAction =
  | "generateArticle"
  | "generateArticleImages"
  | "upsertNews"
  | "upsertOpportunite"
  | "deleteContent";

export function shouldUseAiEditorApi() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host.includes("vercel.app") || host.includes("ivoireprojet.com");
}

async function callAiEditorApi<T>(action: AiAction, data: unknown): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Session expirée ou absente. Reconnectez-vous puis réessayez.");
  }

  const res = await fetch("/api/ai-editor", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, data }),
  });

  const contentType = res.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await res.json().catch(() => null)
    : await res.text().catch(() => "");

  if (!res.ok) {
    const message = typeof body === "object" && body && "error" in body
      ? String((body as { error?: unknown }).error)
      : String(body || res.statusText || "Erreur inconnue");
    const details = typeof body === "object" && body && "details" in body
      ? `\n${String((body as { details?: unknown }).details)}`
      : "";
    throw new Error(`[${action}] HTTP ${res.status} — ${message}${details}`);
  }

  if (!body || typeof body !== "object" || !("result" in body)) {
    throw new Error(`[${action}] Réponse API invalide: ${String(body).slice(0, 300)}`);
  }

  return (body as { result: T }).result;
}

export const generateArticleViaApi = (data: unknown) =>
  callAiEditorApi<any>("generateArticle", data);

export const generateArticleImagesViaApi = (data: unknown) =>
  callAiEditorApi<{ urls: string[] }>("generateArticleImages", data);

export const upsertNewsViaApi = (data: unknown) =>
  callAiEditorApi<{ ok: true; id: string }>("upsertNews", data);

export const upsertOpportuniteViaApi = (data: unknown) =>
  callAiEditorApi<{ ok: true; id: string }>("upsertOpportunite", data);

export const deleteContentViaApi = (data: unknown) =>
  callAiEditorApi<{ ok: true }>("deleteContent", data);