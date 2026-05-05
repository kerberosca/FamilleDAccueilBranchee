"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "../lib/auth-context";
import { useDevMode } from "../lib/dev-mode";
import { Alert } from "./ui/alert";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { accessToken, isAuthLoading } = useAuth();
  const { isDevMode } = useDevMode();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }
    if (accessToken) {
      return;
    }
    const target = encodeURIComponent(pathname || "/me");
    const redirect = isDevMode ? `/dev?next=${target}` : `/login?next=${target}`;
    router.replace(redirect);
  }, [accessToken, isAuthLoading, isDevMode, pathname, router]);

  if (isAuthLoading) {
    return <Alert tone="info">Vérification de la session...</Alert>;
  }

  if (!accessToken) {
    return <Alert tone="info">{isDevMode ? "Redirection vers /dev..." : "Redirection vers la connexion..."}</Alert>;
  }

  return <>{children}</>;
}
