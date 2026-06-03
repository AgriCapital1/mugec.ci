// Bridge client → /api/admin-users (utilisé quand l'app tourne sur Vercel
// ou un autre hébergeur statique où les server functions TanStack ne sont
// pas exécutées).
import { supabase } from "@/lib/supabase";

export function shouldUseAdminUsersApi() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host.includes("vercel.app") || host.includes("ivoireprojet.com");
}

type Action = "list" | "create" | "update" | "delete";

async function call<T>(action: Action, data?: unknown): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Session expirée. Reconnectez-vous puis réessayez.");
  }
  const res = await fetch("/api/admin-users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, data }),
  });
  const ctype = res.headers.get("content-type") ?? "";
  const body = ctype.includes("application/json") ? await res.json().catch(() => null) : await res.text();
  if (!res.ok) {
    const msg = typeof body === "object" && body && "error" in body
      ? String((body as { error: unknown }).error)
      : String(body || res.statusText);
    const details = typeof body === "object" && body && "details" in body
      ? `\n${String((body as { details: unknown }).details)}`
      : "";
    throw new Error(`[admin-users:${action}] HTTP ${res.status} — ${msg}${details}`);
  }
  if (!body || typeof body !== "object" || !("result" in body)) {
    throw new Error(`[admin-users:${action}] Réponse invalide : ${String(body).slice(0, 200)}`);
  }
  return (body as { result: T }).result;
}

export const listAdminUsersApi = () => call<{ users: any[] }>("list");
export const createAdminUserApi = (data: unknown) =>
  call<{ ok: true; user_id: string; password_delivered: string; initial_password: string }>("create", data);
export const updateAdminUserApi = (data: unknown) =>
  call<{ ok: true; password?: string }>("update", data);
export const deleteAdminUserApi = (data: unknown) => call<{ ok: true }>("delete", data);
