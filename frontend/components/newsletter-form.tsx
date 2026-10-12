"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { API_BASE } from "../lib/api";

type FormChallenge = { formToken: string; consentText: string; consentVersion: string };
const UNAVAILABLE = "L’inscription est temporairement indisponible. Réessayez dans quelques minutes.";

export function NewsletterForm({ congress = false }: { congress?: boolean }) {
  const source = congress ? "congres" : "site";
  const [challenge, setChallenge] = useState<FormChallenge | null>(null);
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const sendingRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    setReady(false);
    setChallenge(null);
    async function load() {
      try {
        const response = await fetch(`${API_BASE}/newsletter/form?source=${source}`, {
          cache: "no-store", signal: controller.signal
        });
        const data = await response.json();
        if (!response.ok || !data.formToken || !data.consentText || !data.consentVersion) throw new Error();
        if (controller.signal.aborted) return;
        setChallenge(data);
        timer = setTimeout(() => setReady(true), 1000);
      } catch {
        if (!controller.signal.aborted) setError(UNAVAILABLE);
      }
    }
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [source, retry]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || !challenge || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setError("");
    const fields = new FormData(event.currentTarget);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(`${API_BASE}/newsletter/subscribe`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({
          firstName: String(fields.get("firstName") ?? "").trim(),
          email: String(fields.get("email") ?? "").trim(),
          website: String(fields.get("website") ?? ""),
          source, consent: true, formToken: challenge.formToken
        })
      });
      const data = await response.json();
      if (!response.ok || data.subscribed !== true) {
        const message = response.status === 429
          ? "Plusieurs demandes ont été envoyées. Attendez une minute avant de réessayer."
          : typeof data.message === "string" ? data.message : UNAVAILABLE;
        throw new Error(message);
      }
      setSubscribed(true);
    } catch (err) {
      setError(err instanceof Error && err.name !== "AbortError" ? err.message : UNAVAILABLE);
      setRetry(value => value + 1);
    } finally {
      clearTimeout(timeout);
      sendingRef.current = false;
      setSending(false);
    }
  }

  if (subscribed) {
    return (
      <div role="status" className="mt-6 rounded-2xl border border-[#b8d7c0] bg-[#f0f9f2] p-6 text-[#234c31]">
        <p className="text-lg font-semibold">Merci de votre intérêt pour FAB !</p>
        <p className="mt-2 text-sm leading-6">
          Votre inscription à l’infolettre est enregistrée. Si vous venez de vous inscrire, votre courriel de
          bienvenue arrivera bientôt. Vous recevrez les nouvelles et les détails du lancement en primeur.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-5" aria-label="Inscription à l’infolettre FAB" aria-busy={sending}>
      <div>
        <label htmlFor="newsletter-first-name" className="block text-sm font-semibold">Prénom</label>
        <input id="newsletter-first-name" name="firstName" autoComplete="given-name" required maxLength={80}
          disabled={sending} className="mt-2 w-full rounded-xl border border-[#c9c0df] bg-white px-4 py-3 text-[#21183f] focus:border-[#6b48b0] focus:outline-none focus:ring-2 focus:ring-[#6b48b0]/30" />
      </div>
      <div>
        <label htmlFor="newsletter-email" className="block text-sm font-semibold">Adresse courriel</label>
        <input id="newsletter-email" name="email" type="email" inputMode="email" autoComplete="email" required maxLength={254}
          disabled={sending} className="mt-2 w-full rounded-xl border border-[#c9c0df] bg-white px-4 py-3 text-[#21183f] focus:border-[#6b48b0] focus:outline-none focus:ring-2 focus:ring-[#6b48b0]/30" />
      </div>
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="newsletter-website">Site Web</label>
        <input id="newsletter-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {challenge && (
        <p id="newsletter-consent" className="text-xs leading-5 text-[#554c76]">
          {challenge.consentText}{" "}
          <Link href="/confidentialite" className="font-semibold underline">Politique de confidentialité</Link>.
        </p>
      )}
      <button type="submit" disabled={!ready || sending} aria-describedby="newsletter-consent"
        className="w-full rounded-xl bg-[#ec825f] px-5 py-3.5 font-semibold text-[#21183f] transition hover:bg-[#df6d46] focus:outline-none focus:ring-2 focus:ring-[#6b48b0] focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60">
        {sending ? "Inscription en cours…" : "Je m’inscris"}
      </button>
      <div aria-live="polite">
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {!challenge && !error && <p className="text-sm text-[#554c76]">Chargement du formulaire…</p>}
      </div>
      {!challenge && error && <button type="button" onClick={() => { setError(""); setRetry(value => value + 1); }}
        className="text-sm font-semibold text-[#554c76] underline">Réessayer de charger le formulaire</button>}
      <p className="text-xs leading-5 text-[#625a7d]">
        Forméduc — 5121 boul. Chauveau Ouest, local 101, Québec (Québec) G2E 5A6. Nous joindre :{" "}
        <a href="mailto:info@familledaccueilbranchee.ca" className="break-all underline">info@familledaccueilbranchee.ca</a>.
      </p>
    </form>
  );
}
