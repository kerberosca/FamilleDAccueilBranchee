"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { RequireAuth } from "../../../components/require-auth";
import { apiGet, apiPost } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";

type MeResponse = { id: string; email: string; role: string };

type Message = { id: string; content: string; createdAt: string; senderUserId: string };

type ConversationDetail = {
  id: string;
  familyId: string;
  resourceId: string;
  family: { id: string; displayName: string };
  resource: { id: string; displayName: string };
  messages: Message[];
  updatedAt: string;
};

export default function ConversationPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = typeof params.id === "string" ? params.id : "";
  const { accessToken } = useAuth();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accessToken || !conversationId) return;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [meData, convData] = await Promise.all([
          apiGet<MeResponse>("/users/me", { token: accessToken }),
          apiGet<ConversationDetail>(`/messaging/conversations/${conversationId}`, { token: accessToken }),
        ]);
        setMe(meData);
        setConversation(convData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Conversation introuvable.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [accessToken, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages?.length]);

  const onSubmitMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!accessToken || !conversationId || !newMessage.trim()) return;
    setSending(true);
    setError(null);
    try {
      const updated = await apiPost<ConversationDetail>(`/messaging/conversations/${conversationId}/messages`, {
        token: accessToken,
        body: { content: newMessage.trim() },
      });
      setConversation(updated);
      setNewMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible.");
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
        <div className="flex items-center gap-2">
          <Link href="/messages" className="text-sm font-medium text-[#b9ccff] no-underline hover:text-[#d3dfff]">
            Retour messages
          </Link>
        </div>

        <section className="rounded-[24px] border border-white/20 bg-gradient-to-r from-[#22184f]/85 via-[#261d57]/78 to-[#2e2462]/74 p-6 text-white shadow-[0_20px_52px_-38px_rgba(8,6,26,0.95)]">
          <h1 className="text-2xl font-semibold sm:text-3xl">Conversation</h1>
          <p className="mt-2 text-sm text-[#ebe6ff] sm:text-base">Suivez vos echanges en temps reel.</p>
        </section>

        <RequireAuth>
          {loading ? <Alert tone="info">Chargement...</Alert> : null}
          {error ? <Alert tone="error">{error}</Alert> : null}

          {!loading && conversation ? (
            <>
              <Card className="space-y-2 border-[#4e4771] bg-[#171134]/75 backdrop-blur-sm">
                <p className="text-sm text-slate-300">
                  Avec {me?.role === "FAMILY" ? conversation.resource?.displayName : conversation.family?.displayName}
                </p>
              </Card>

              <Card className="flex max-h-[70vh] flex-col border-[#4e4771] bg-[#171134]/75 p-0 backdrop-blur-sm">
                <div className="flex-1 space-y-2 overflow-y-auto p-3">
                  {conversation.messages?.map((msg) => {
                    const isMe = Boolean(me && msg.senderUserId === me.id);
                    return (
                      <div
                        key={msg.id}
                        className={`rounded-xl border px-3 py-2 text-sm ${
                          isMe
                            ? "ml-8 border-[#6f8fe2]/35 bg-[#2a3f78]/45"
                            : "mr-8 border-[#4f476f] bg-[#110d2a]"
                        }`}
                      >
                        <span className="font-medium text-white">{isMe ? "Toi" : "Autre"}</span>
                        <span className="ml-2 text-slate-200">{msg.content}</span>
                        <p className="mt-1 text-xs text-slate-400">{new Date(msg.createdAt).toLocaleString("fr-CA")}</p>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                <form onSubmit={onSubmitMessage} className="flex gap-2 border-t border-[#4f476f] p-3">
                  <input
                    type="text"
                    className="flex-1 rounded-md border border-[#4f476f] bg-[#0f0b24] px-3 py-2 text-sm text-slate-100 placeholder:text-[#8b84ad] focus:border-[#6f8fe2] focus:outline-none focus:ring-1 focus:ring-[#6f8fe2]/35"
                    placeholder="Votre message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    required
                  />
                  <Button
                    type="submit"
                    disabled={sending}
                    className="!rounded-xl !bg-[#3567b7] !font-semibold hover:!bg-[#2f5da6]"
                  >
                    {sending ? "..." : "Envoyer"}
                  </Button>
                </form>
              </Card>
            </>
          ) : null}

          {!loading && !conversation && !error ? (
            <Button
              variant="secondary"
              onClick={() => router.push("/messages")}
              className="!rounded-xl !bg-[#262148] !text-[#ece8ff] hover:!bg-[#30295a]"
            >
              Retour aux messages
            </Button>
          ) : null}
        </RequireAuth>
      </div>
    </main>
  );
}

