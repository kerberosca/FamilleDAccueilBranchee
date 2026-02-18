"use client";

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

async function requestJson<T>(
  path: string,
  options: RequestOptions & { method: "GET" | "POST" | "PATCH" }
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
    const message =
      (json as { message?: string | string[] } | null)?.message ??
      `HTTP ${response.status} on ${path}`;
    throw new ApiError(Array.isArray(message) ? message.join(", ") : message, response.status, json);
  }

  return json as T;
}
