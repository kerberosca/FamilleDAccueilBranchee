"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { RequireAuth } from "../../components/require-auth";
import { apiGet, apiPost } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

type MeResponse = { id: string; email: string; role: string; status: string };

type ConversationListItem = {
  id: string;
  familyId: string;
  resourceId: string;
  family: { id: string; displayName: string };
  resource: { id: string; displayName: string };
  messages: Array<{ id: string; content: string; createdAt: string; senderUserId: string }>;
  updatedAt: string;
};

function MessagesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contactResourceId = searchParams.get("contact");
  const { accessToken } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialMessage, setInitialMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [meData, convData] = await Promise.all([
          apiGet<MeResponse>("/users/me", { token: accessToken }),
          apiGet<ConversationListItem[]>("/messaging/conversations", { token: accessToken }),
        ]);
        setMe(meData);
        setConversations(Array.isArray(convData) ? convData : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur chargement.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [accessToken]);

  const onSubmitNewConversation = async (e: FormEvent) => {
    e.preventDefault();
    if (!accessToken || !contactResourceId || !initialMessage.trim()) return;
    setSending(true);
    setError(null);
    try {
      const conv = await apiPost<{ id: string }>("/messaging/conversations", {
        token: accessToken,
        body: { resourceProfileId: contactResourceId, initialMessage: initialMessage.trim() },
      });
      router.replace(`/messages/${conv.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de creer la conversation.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="relative isolate overflow-hidden px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(980px 420px at -10% -8%, rgba(242,157,82,0.18), transparent), radial-gradient(760px 360px at 108% 4%, rgba(118,106,204,0.24), transparent), linear-gradient(180deg, #130e2d 0%, #100c26 60%, #0d0a1f 100%)",
          }}
          aria-hidden
        />
      </div>

      <div className="mx-auto max-w-4xl space-y-4">
        <section className="rounded-[24px] border border-white/20 bg-gradient-to-r from-[#22184f]/85 via-[#261d57]/78 to-[#2e2462]/74 p-6 text-white shadow-[0_20px_52px_-38px_rgba(8,6,26,0.95)]">
          <h1 className="text-2xl font-semibold sm:text-3xl">Messages</h1>
          <p className="mt-2 text-sm text-[#ebe6ff] sm:text-base">
            Échangez avec les familles et les alliés dans un espace simple et clair.
          </p>
        </section>

        <RequireAuth>
          {loading ? <Alert tone="info">Chargement...</Alert> : null}
          {error ? <Alert tone="error">{error}</Alert> : null}

          {contactResourceId && me && !loading ? (
            <Card className="space-y-3 border-[#4e4771] bg-[#171134]/75 backdrop-blur-sm">
              <h2 className="text-lg font-medium text-white">Nouvelle conversation</h2>
              {me.role === "FAMILY" ? (
                <form onSubmit={onSubmitNewConversation} className="grid gap-3">
                  <textarea
                    className="min-h-28 w-full rounded-md border border-[#4f476f] bg-[#0f0b24] px-3 py-2 text-sm text-slate-100 placeholder:text-[#8b84ad] focus:border-[#6f8fe2] focus:outline-none focus:ring-1 focus:ring-[#6f8fe2]/35"
                    placeholder="Votre message initial..."
                    value={initialMessage}
                    onChange={(e) => setInitialMessage(e.target.value)}
                    required
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="submit"
                      disabled={sending}
                      className="!rounded-xl !bg-[#3567b7] !font-semibold hover:!bg-[#2f5da6]"
                    >
                      {sending ? "Envoi..." : "Envoyer et ouvrir la conversation"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => router.replace("/messages")}
                      className="!rounded-xl !bg-[#262148] !text-[#ece8ff] hover:!bg-[#30295a]"
                    >
                      Annuler
                    </Button>
                  </div>
                </form>
              ) : (
                <Alert tone="info">Seules les familles peuvent contacter les alliés.</Alert>
              )}
            </Card>
          ) : null}

          <Card className="space-y-3 border-[#4e4771] bg-[#171134]/75 backdrop-blur-sm">
            <h2 className="text-lg font-medium text-white">Conversations</h2>
            {conversations.length === 0 && !loading ? (
              <p className="text-sm text-slate-300">Aucune conversation.</p>
            ) : (
              <ul className="space-y-2">
                {conversations.map((c) => {
                  const label = me?.role === "FAMILY" ? c.resource?.displayName : c.family?.displayName;
                  return (
                    <li key={c.id}>
                      <Link
                        href={`/messages/${c.id}`}
                        className="block rounded-xl border border-[#4f476f] bg-[#110d2a] px-3 py-2 text-sm text-[#b9ccff] no-underline transition-colors hover:bg-[#1a1438] hover:text-[#d3dfff]"
                      >
                        Avec {label ?? "-"} - {c.messages?.length ?? 0} message(s)
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </RequireAuth>
      </div>
    </main>
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-2xl p-6">
          <p className="text-slate-300">Chargement...</p>
        </main>
      }
    >
      <MessagesContent />
    </Suspense>
  );
}

