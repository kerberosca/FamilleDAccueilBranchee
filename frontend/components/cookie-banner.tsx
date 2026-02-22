"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";

const STORAGE_KEY = "fab-cookie-notice-seen";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY);
      if (!seen) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Information sur les cookies"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-700/80 bg-slate-900/95 px-4 py-3 shadow-lg backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-300">
          Ce site utilise uniquement des <strong>cookies strictement nécessaires</strong> au fonctionnement (connexion, session). Nous n&apos;utilisons pas de cookies publicitaires ni analytiques.{" "}
          <Link href="/confidentialite#cookies" className="text-cyan-400 underline hover:text-cyan-300">
            En savoir plus
          </Link>
        </p>
        <Button type="button" variant="primary" onClick={handleAccept} className="shrink-0">
          J&apos;ai compris
        </Button>
      </div>
    </div>
  );
}
