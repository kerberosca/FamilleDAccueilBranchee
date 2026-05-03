"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { ApiError, apiPost } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

type LoginResponse = {
  accessToken: string;
  refreshToken?: string;
  user: { id: string; email: string; role: string };
};

const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/me";
  const { setTokens } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiPost<LoginResponse>("/auth/login", {
        body: { email: email.trim(), password },
      });
      setTokens(res.accessToken, res.refreshToken);
      router.push(next);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message || "Connexion impossible."
          : err instanceof Error
            ? err.message
            : "Connexion impossible.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative isolate overflow-hidden px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(900px 380px at -12% -8%, rgba(242,157,82,0.18), transparent), radial-gradient(760px 360px at 110% 4%, rgba(118,106,204,0.24), transparent), linear-gradient(180deg, #130e2d 0%, #100c26 60%, #0d0a1f 100%)",
          }}
          aria-hidden
        />
      </div>

      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <section className="rounded-[28px] border border-white/20 bg-gradient-to-br from-[#22184f]/88 via-[#261d57]/82 to-[#2e2462]/75 p-7 text-white shadow-[0_22px_58px_-42px_rgba(7,6,25,0.95)] backdrop-blur-sm sm:p-8">
          <span className="inline-flex rounded-full border border-white/30 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/90">
            Espace membre
          </span>
          <h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">Connexion</h1>
          <p className="mt-3 text-sm text-[#ece7ff] sm:text-base">
            Accedez a votre espace FAB pour gerer votre profil, vos demandes et vos messages.
          </p>
          <div className="mt-6 space-y-2 text-sm text-[#e5e0fa]">
            <p>1. Profil et disponibilites centralises</p>
            <p>2. Recherche d&apos;allies en quelques clics</p>
            <p>3. Parcours simple et securise</p>
          </div>
        </section>

        <Card className="border-[#d7d2ea] bg-white/95 text-[#261f44] shadow-[0_22px_52px_-38px_rgba(21,16,49,0.95)]">
          <form onSubmit={onSubmit} className="grid gap-3">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="!border-[#d7d3ea] !bg-white !text-[#211a3e] placeholder:!text-[#7a7394] focus:!border-[#3469b9] focus:!ring-[#3469b9]/35"
            />
            <Input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="!border-[#d7d3ea] !bg-white !text-[#211a3e] placeholder:!text-[#7a7394] focus:!border-[#3469b9] focus:!ring-[#3469b9]/35"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <Button
                type="submit"
                disabled={loading}
                className="!rounded-xl !bg-[#3469b9] !px-5 !py-2.5 !text-sm !font-semibold !text-white hover:!bg-[#2d5ea8] disabled:!bg-[#a8b8db]"
              >
                {loading ? "Connexion..." : "Se connecter"}
              </Button>
              <Link href="/forgot-password" className="text-sm font-medium text-[#3d5fa8] hover:text-[#2e4f97]">
                Mot de passe oublie ?
              </Link>
            </div>
          </form>

          {error ? <div className="mt-4"><Alert tone="error">{error}</Alert></div> : null}

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <Link href="/onboarding" className="font-medium text-[#3d5fa8] hover:text-[#2e4f97]">
              Creer un compte
            </Link>
            {DEV_BYPASS ? (
              <Link href="/dev" className="font-medium text-[#3d5fa8] hover:text-[#2e4f97]">
                Mode dev (bypass login)
              </Link>
            ) : null}
          </div>
        </Card>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-md p-6">
          <p className="text-slate-300">Chargement...</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
