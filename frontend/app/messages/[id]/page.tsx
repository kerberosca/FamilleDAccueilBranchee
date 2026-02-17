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
          apiGet<ConversationDetail>(`/messaging/conversations/${conversationId}`, { token: accessToken })
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
      const updated = await apiPost<ConversationDetail>(
        `/messaging/conversations/${conversationId}/messages`,
        { token: accessToken, body: { content: newMessage.trim() } }
      );
      setConversation(updated);
      setNewMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-center gap-2">
        <Link href="/messages" className="text-sm text-cyan-400 hover:underline">
          ← Messages
        </Link>
      </div>
      <h1 className="text-2xl font-semibold">Conversation</h1>
      <RequireAuth>
        {loading ? <Alert tone="info">Chargement...</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        {!loading && conversation ? (
          <>
            <Card className="space-y-2">
              <p className="text-sm text-slate-400">
                Avec {me?.role === "FAMILY" ? conversation.resource?.displayName : conversation.family?.displayName}
              </p>
            </Card>
            <Card className="flex max-h-96 flex-col">
              <div className="flex-1 space-y-2 overflow-y-auto p-2">
                {conversation.messages?.map((msg) => {
                  const isMe = me && msg.senderUserId === me.id;
                  return (
                    <div
                      key={msg.id}
                      className={`rounded p-2 text-sm ${isMe ? "ml-8 bg-cyan-900/40" : "mr-8 bg-slate-800"}`}
                    >
                      <span className="font-medium">{isMe ? "Toi" : "Autre"}</span>
                      <span className="ml-2 text-slate-300">{msg.content}</span>
                      <p className="mt-1 text-xs text-slate-500">
                        {new Date(msg.createdAt).toLocaleString("fr-CA")}
                      </p>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={onSubmitMessage} className="flex gap-2 border-t border-slate-700 p-2">
                <input
                  type="text"
                  className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                  placeholder="Votre message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  required
                />
                <Button type="submit" disabled={sending}>
                  {sending ? "..." : "Envoyer"}
                </Button>
              </form>
            </Card>
          </>
        ) : null}
        {!loading && !conversation && !error ? (
          <Button variant="secondary" onClick={() => router.push("/messages")}>
            Retour aux messages
          </Button>
        ) : null}
      </RequireAuth>
    </main>
  );
}
