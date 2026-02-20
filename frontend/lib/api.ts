"use client";

import { AUTH_TOKENS_EVENT, REFRESH_STORAGE_KEY } from "./auth-constants";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

export class ApiError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

type RequestOptions = {
  token?: string | null;
  body?: unknown;
};

export async function apiGet<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return requestJson<T>(path, { ...options, method: "GET" });
}

export async function apiPost<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return requestJson<T>(path, { ...options, method: "POST" });
}

export async function apiPatch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return requestJson<T>(path, { ...options, method: "PATCH" });
}

async function tryRefresh(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const refreshToken = window.sessionStorage.getItem(REFRESH_STORAGE_KEY);
  if (!refreshToken) return null;
  const url = `${API_BASE}/auth/refresh`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken })
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    window.sessionStorage.setItem(REFRESH_STORAGE_KEY, data.refreshToken);
    window.dispatchEvent(
      new CustomEvent(AUTH_TOKENS_EVENT, { detail: { accessToken: data.accessToken, refreshToken: data.refreshToken } })
    );
    return data.accessToken;
  } catch {
    return null;
  }
}

function redirectToLogin() {
  if (typeof window === "undefined") return;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `/login?next=${next}`;
}

async function requestJson<T>(
  path: string,
  options: RequestOptions & { method: "GET" | "POST" | "PATCH" },
  isRetryAfterRefresh = false
): Promise<T> {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(url, {
    method: options.method,
    headers,
    body: typeof options.body === "undefined" ? undefined : JSON.stringify(options.body)
  });

  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    // Ignore non-json responses.
  }

  if (!response.ok) {
    if (response.status === 503 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("fab-maintenance-503"));
    }
    if (
      response.status === 401 &&
      !isRetryAfterRefresh &&
      typeof window !== "undefined" &&
      !path.includes("/auth/refresh")
    ) {
      const newAccess = await tryRefresh();
      if (newAccess) {
        return requestJson<T>(path, { ...options, token: newAccess }, true);
      }
      redirectToLogin();
      const message =
        (json as { message?: string | string[] } | null)?.message ??
        `HTTP ${response.status} on ${path}`;
      throw new ApiError(Array.isArray(message) ? message.join(", ") : message, response.status, json);
    }
    const message =
      (json as { message?: string | string[] } | null)?.message ??
      `HTTP ${response.status} on ${path}`;
    throw new ApiError(Array.isArray(message) ? message.join(", ") : message, response.status, json);
  }

  return json as T;
}
