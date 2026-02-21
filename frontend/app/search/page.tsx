"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ResourceCard } from "../../components/resource-card";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { apiGet } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

type SearchResponse = {
  totalFound?: number;
  meta?: {
    total?: number;
  };
  page?: number;
  pageSize?: number;
  limitedPreview?: boolean;
  results: Array<{
    id: string;
    displayName: string;
    city?: string;
    region?: string;
    skillsTags?: string[];
    contactEmail?: string;
    contactPhone?: string;
  }>;
};

type SearchQuery = {
  postalCode: string;
  tags: string;
  page: number;
};

const DEFAULT_QUERY: SearchQuery = {
  postalCode: "H2X1Y4",
  tags: "",
  page: 1
};
const FSA_REGEX = /^[A-Z][0-9][A-Z]$/;
const FULL_POSTAL_REGEX = /^[A-Z][0-9][A-Z][0-9][A-Z][0-9]$/;

export default function SearchPage() {
  const { accessToken } = useAuth();
  const initialized = useRef(false);
  const queryRef = useRef<SearchQuery>(DEFAULT_QUERY);
  const [formPostalCode, setFormPostalCode] = useState(DEFAULT_QUERY.postalCode);
  const [formTags, setFormTags] = useState("");
  const [query, setQuery] = useState<SearchQuery>(DEFAULT_QUERY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SearchResponse | null>(null);
  const normalizedPostalCode = normalizePostalCode(formPostalCode);
  const isFsa = FSA_REGEX.test(normalizedPostalCode);
  const isFullPostal = FULL_POSTAL_REGEX.test(normalizedPostalCode);
  const isPostalCodeValid = isFsa || isFullPostal;

  const runSearch = useCallback(
    async (nextQuery: SearchQuery, options: { pushHistory: boolean; syncForm: boolean }) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          postalCode: nextQuery.postalCode,
          page: String(nextQuery.page)
        });
        if (nextQuery.tags.trim()) {
          params.set("tags", nextQuery.tags.trim());
        }
        const result = await apiGet<SearchResponse>(`/search/resources?${params.toString()}`, { token: accessToken });
        setData(result);
        setQuery(nextQuery);
        queryRef.current = nextQuery;

        if (options.syncForm) {
          setFormPostalCode(nextQuery.postalCode);
          setFormTags(nextQuery.tags);
        }

        if (options.pushHistory) {
          const nextUrl = `/search?${params.toString()}`;
          window.history.pushState({}, "", nextUrl);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur inconnue");
      } finally {
        setLoading(false);
      }
    },
    [accessToken]
  );

  // Lancer la recherche à l'arrivée : lire l'URL réelle (window.location) + revérifier après un court délai
  // (après router.push() Next.js peut mettre à jour l'URL juste après le premier rendu)
  useEffect(() => {
    const runFromUrl = () => {
      const q = parseQuery(window.location.search);
      const same =
        queryRef.current.postalCode === q.postalCode &&
        queryRef.current.tags === q.tags &&
        queryRef.current.page === q.page;
      if (!same) {
        void runSearch(q, { pushHistory: false, syncForm: true });
      }
    };
    if (!initialized.current) {
      initialized.current = true;
      runFromUrl();
    }
    const t = setTimeout(runFromUrl, 250);
    return () => clearTimeout(t);
  }, [runSearch]);

  useEffect(() => {
    const onPopState = () => {
      const nextQuery = parseQuery(window.location.search);
      void runSearch(nextQuery, { pushHistory: false, syncForm: true });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [runSearch]);

  useEffect(() => {
    if (!initialized.current) {
      return;
    }
    void runSearch(queryRef.current, { pushHistory: false, syncForm: false });
  }, [accessToken, runSearch]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextPostalCode = normalizePostalCode(formPostalCode);
    if (!isValidPostalInput(nextPostalCode)) {
      setError("Code postal invalide. Utilise 3 caracteres (FSA, ex: H2X) ou 6 caracteres (ex: H2X1Y4).");
      return;
    }
    await runSearch({
      postalCode: nextPostalCode,
      tags: formTags,
      page: 1
    }, { pushHistory: true, syncForm: false });
  };

  const onNextPage = async () => {
    await runSearch({
      ...query,
      page: currentPage + 1
    }, { pushHistory: true, syncForm: false });
  };

  const onPreviousPage = async () => {
    await runSearch({
      ...query,
      page: currentPage - 1
    }, { pushHistory: true, syncForm: false });
  };

  const total = data?.totalFound ?? data?.meta?.total ?? 0;
  const currentPage = data?.page ?? query.page;
  const pageSize = data?.pageSize ?? Math.max(1, data?.results.length ?? 1);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const isPreview = Boolean(data?.limitedPreview);
  const canGoPrevious = !isPreview && currentPage > 1 && !loading;
  const canGoNext = !isPreview && currentPage < totalPages && !loading;
  const showEmptyState = !loading && Boolean(data) && (data?.results?.length ?? 0) === 0;
  const skeletonCount = Math.max(1, Math.min(3, pageSize));

  return (
    <main className="mx-auto max-w-4xl space-y-5 p-6">
      <h1 className="text-2xl font-semibold">Recherche d'alliés</h1>

      <form onSubmit={onSubmit} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
        <Input
          value={formPostalCode}
          onChange={(e) => setFormPostalCode(normalizePostalCode(e.target.value))}
          placeholder="Code postal (FSA A1A ou complet A1A1A1)"
        />
        <Input value={formTags} onChange={(e) => setFormTags(e.target.value)} placeholder="Tags (ex: transport,repit)" />
        <Button type="submit" disabled={loading || !isPostalCodeValid}>
          {loading ? "Recherche..." : "Rechercher"}
        </Button>
      </form>

      <p className="text-xs text-slate-400">
        Tu peux chercher par FSA (3 premiers caracteres, ex: `H2X`) ou code postal complet (ex: `H2X1Y4`).
      </p>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {data ? (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-200">
            Total: <strong>{total}</strong> | Page: <strong>{currentPage}</strong> / {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onPreviousPage} disabled={!canGoPrevious}>
              Precedent
            </Button>
            <Button type="button" variant="secondary" onClick={onNextPage} disabled={!canGoNext}>
              Suivant
            </Button>
          </div>
        </Card>
      ) : null}

      {isPreview ? (
        <Alert tone="info">
          Mode preview actif: seuls quelques alliés sont visibles. Passe en abonnement actif pour pagination +
          contacts.
        </Alert>
      ) : null}

      {loading ? (
        <section className="grid gap-3">
          {Array.from({ length: skeletonCount }).map((_, index) => (
            <Card key={`skeleton-${index}`} className="animate-pulse">
              <div className="h-5 w-40 rounded bg-slate-700" />
              <div className="mt-3 h-4 w-56 rounded bg-slate-800" />
              <div className="mt-2 h-4 w-64 rounded bg-slate-800" />
            </Card>
          ))}
        </section>
      ) : null}

      {showEmptyState ? (
        <Card>
          <p className="text-sm text-slate-300">
            Aucun resultat pour ce filtre. Essaie un autre code postal ou des tags differents.
          </p>
        </Card>
      ) : null}

      <section className="grid gap-3">
        {data?.results?.map((resource) => (
          <ResourceCard
            key={resource.id}
            resource={resource}
            isPremiumUser={!data?.limitedPreview}
          />
        ))}
      </section>
    </main>
  );
}

function parseQuery(search: string): SearchQuery {
  const params = new URLSearchParams(search);
  const postalCode = normalizePostalCode(params.get("postalCode") || DEFAULT_QUERY.postalCode);
  const tags = params.get("tags")?.trim() || "";
  const rawPage = Number(params.get("page") || String(DEFAULT_QUERY.page));
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  return { postalCode, tags, page };
}

function normalizePostalCode(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

function isValidPostalInput(value: string): boolean {
  return FSA_REGEX.test(value) || FULL_POSTAL_REGEX.test(value);
}
