"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export function MaintenancePage() {
  const [logoSrc, setLogoSrc] = useState("/images/logo.png");
  const [logoError, setLogoError] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center">
      <div className="max-w-md space-y-6">
        {!logoError && (
          <div className="flex justify-center">
            <Image
              src={logoSrc}
              alt="FAB"
              width={80}
              height={80}
              className="h-20 w-auto object-contain"
              onError={() => {
                if (logoSrc === "/images/logo.png") {
                  setLogoSrc("/images/Logo.png");
                } else {
                  setLogoError(true);
                }
              }}
              unoptimized
            />
          </div>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Maintenance en cours
        </h1>
        <p className="text-slate-400">
          Le site est temporairement indisponible. Merci de réessayer dans quelques instants.
        </p>
        <div className="h-12 w-12 animate-pulse rounded-full bg-cyan-500/20 mx-auto" aria-hidden />
        <p className="text-sm text-slate-500">
          <Link href="/admin" className="underline hover:text-slate-400">
            Espace admin
          </Link>
        </p>
      </div>
    </div>
  );
}
