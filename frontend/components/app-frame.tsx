"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui/button";
import { useAuth } from "../lib/auth-context";
import { useDevMode } from "../lib/dev-mode";

function NavLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`
        relative rounded-lg px-3 py-2.5 text-sm font-medium no-underline transition-all duration-200
        hover:text-white
        ${active ? "text-cyan-400" : "text-slate-400"}
      `}
    >
      {active && (
        <span
          className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.6)]"
          aria-hidden
        />
      )}
      <span className="relative">{children}</span>
    </Link>
  );
}

export function AppFrame({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, logout } = useAuth();
  const { isDevMode, setDevMode } = useDevMode();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoSrc, setLogoSrc] = useState("/images/logo.png");
  const [logoError, setLogoError] = useState(false);

  const confirmNavigationIfDirty = () => {
    const hasUnsavedChanges = Boolean((window as { __fabUnsavedChanges?: boolean }).__fabUnsavedChanges);
    if (!hasUnsavedChanges) return true;
    return window.confirm("Tu as des modifications non enregistrées. Quitter cette page ?");
  };

  const handleNavClick = (e: React.MouseEvent) => {
    if (!confirmNavigationIfDirty()) e.preventDefault();
  };

  const handleLogout = async () => {
    if (!confirmNavigationIfDirty()) return;
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
    router.push(isDevMode ? "/dev" : "/login");
  };

  const switchView = () => {
    setDevMode(!isDevMode);
    window.location.reload();
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div
          className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent"
          aria-hidden
        />
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <div className="flex items-center gap-6 sm:gap-10">
            <Link
              href="/"
              onClick={handleNavClick}
              className="flex items-center gap-2 no-underline outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              {!logoError && (
                <Image
                  src={logoSrc}
                  alt=""
                  width={52}
                  height={52}
                  className="h-[52px] w-auto object-contain"
                  onError={() => {
                    if (logoSrc === "/images/logo.png") {
                      setLogoSrc("/images/Logo.png");
                    } else {
                      setLogoError(true);
                    }
                  }}
                  unoptimized
                />
              )}
              <span className="text-xl font-bold tracking-tight text-white">FAB</span>
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]" aria-hidden />
            </Link>
            <nav className="flex flex-wrap items-center gap-0.5 sm:gap-1" aria-label="Navigation principale">
              <NavLink href="/" onClick={handleNavClick}>Accueil</NavLink>
              <NavLink href="/onboarding" onClick={handleNavClick}>Premiers pas</NavLink>
              <NavLink href="/login" onClick={handleNavClick}>Connexion</NavLink>
              {isDevMode && <NavLink href="/dev" onClick={handleNavClick}>Dev</NavLink>}
              <NavLink href="/me" onClick={handleNavClick}>Mon profil</NavLink>
              <NavLink href="/search" onClick={handleNavClick}>Recherche</NavLink>
              <NavLink href="/messages" onClick={handleNavClick}>Messages</NavLink>
              <NavLink href="/admin" onClick={handleNavClick}>Admin</NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span
              className="rounded-full border border-slate-600/80 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-300 backdrop-blur-sm"
              title={isAuthenticated ? "Session connectée" : "Session invitée"}
            >
              {isAuthenticated ? "Connecté" : "Invité"}
            </span>
            <button
              type="button"
              onClick={switchView}
              className="rounded-lg border border-slate-600/80 bg-slate-800/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-all hover:border-cyan-500/40 hover:bg-slate-700/80 hover:text-slate-100"
              title={isDevMode ? "Passer en vue prod" : "Passer en vue dev"}
            >
              {isDevMode ? "Vue prod" : "Vue dev"}
            </button>
            {isAuthenticated && (
              <Button
                type="button"
                variant="secondary"
                className="px-4 py-1.5 text-xs font-medium"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut ? "Déconnexion…" : "Déconnexion"}
              </Button>
            )}
          </div>
        </div>
      </header>
      <div className="relative">{children}</div>
    </div>
  );
}
