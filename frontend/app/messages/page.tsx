"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState, Suspense } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
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
          apiGet<ConversationListItem[]>("/messaging/conversations", { token: accessToken })
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
        body: { resourceProfileId: contactResourceId, initialMessage: initialMessage.trim() }
      });
      router.replace(`/messages/${conv.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de créer la conversation.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Messages</h1>
      <RequireAuth>
        {loading ? <Alert tone="info">Chargement...</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}

        {contactResourceId && me && !loading ? (
          <Card className="space-y-3">
            <h2 className="text-lg font-medium">Nouvelle conversation</h2>
            {me.role === "FAMILY" ? (
              <form onSubmit={onSubmitNewConversation} className="grid gap-2">
                <textarea
                  className="min-h-24 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                  placeholder="Votre message initial..."
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                  required
                />
                <div className="flex gap-2">
                  <Button type="submit" disabled={sending}>
                    {sending ? "Envoi..." : "Envoyer et ouvrir la conversation"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => router.replace("/messages")}>
                    Annuler
                  </Button>
                </div>
              </form>
            ) : (
              <Alert tone="info">Seules les familles (avec abonnement actif) peuvent contacter les alliés.</Alert>
            )}
          </Card>
        ) : null}

        <Card className="space-y-2">
          <h2 className="text-lg font-medium">Conversations</h2>
          {conversations.length === 0 && !loading ? (
            <p className="text-sm text-slate-400">Aucune conversation.</p>
          ) : (
            <ul className="space-y-2">
              {conversations.map((c) => {
                const label = me?.role === "FAMILY" ? c.resource?.displayName : c.family?.displayName;
                return (
                  <li key={c.id}>
                    <Link href={`/messages/${c.id}`} className="block rounded p-2 text-sm text-cyan-400 hover:bg-slate-800">
                      Avec {label ?? "—"} · {c.messages?.length ?? 0} message(s)
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </RequireAuth>
    </main>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-2xl p-6"><p className="text-slate-400">Chargement...</p></main>}>
      <MessagesContent />
    </Suspense>
  );
}
