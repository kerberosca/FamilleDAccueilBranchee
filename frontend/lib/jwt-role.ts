export type UserRole = "ADMIN" | "FAMILY" | "RESOURCE";

export function getRoleFromAccessToken(accessToken: string | null): UserRole | null {
  if (!accessToken || typeof window === "undefined") return null;

  try {
    const payloadPart = accessToken.split(".")[1];
    if (!payloadPart) return null;
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(window.atob(padded)) as { role?: string };
    return isUserRole(payload.role) ? payload.role : null;
  } catch {
    return null;
  }
}

function isUserRole(role: string | undefined): role is UserRole {
  return role === "ADMIN" || role === "FAMILY" || role === "RESOURCE";
}
