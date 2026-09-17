import { ApiError } from "@/types/api";

const API_URL = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/$/, "");

export type TokenGetter = () => string | null;

let getToken: TokenGetter = () => localStorage.getItem("algocraft_token");

export function setTokenGetter(getter: TokenGetter): void {
  getToken = getter;
}

export function apiUrl(path: string): string {
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  opts: { auth?: boolean } = { auth: true },
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (opts.auth !== false) {
    const token = getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const res = await fetch(apiUrl(path), { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) {
        message = parsed.error;
      }
    } catch {
      /* keep raw */
    }
    throw new ApiError(res.status, message);
  }
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}
