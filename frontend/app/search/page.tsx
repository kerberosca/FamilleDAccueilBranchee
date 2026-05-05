"use client";

import Image from "next/image";
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
  page: 1,
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
          page: String(nextQuery.page),
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
    await runSearch(
      {
        postalCode: nextPostalCode,
        tags: formTags,
        page: 1,
      },
      { pushHistory: true, syncForm: false }
    );
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

  const onNextPage = async () => {
    await runSearch(
      {
        ...query,
        page: currentPage + 1,
      },
      { pushHistory: true, syncForm: false }
    );
  };

  const onPreviousPage = async () => {
    await runSearch(
      {
        ...query,
        page: currentPage - 1,
      },
      { pushHistory: true, syncForm: false }
    );
  };

  return (
    <main className="relative isolate overflow-hidden px-4 pb-16 pt-8 sm:px-6 sm:pt-10 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(1000px 420px at -8% -10%, rgba(242,157,82,0.2), transparent), radial-gradient(900px 420px at 108% 8%, rgba(118,106,204,0.22), transparent), linear-gradient(180deg, #130e2d 0%, #100c26 55%, #0d0a1f 100%)",
          }}
          aria-hidden
        />
      </div>

      <div className="mx-auto max-w-6xl space-y-6">
        <section className="relative overflow-hidden rounded-[28px] border border-white/20 shadow-[0_20px_60px_-42px_rgba(7,6,25,0.95)]">
          <Image
            src="/images/hero-fab.png"
            alt="Parent et enfant au coucher du soleil."
            fill
            className="object-cover object-center"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#18113a]/92 via-[#20154a]/84 to-[#25184a]/74" aria-hidden />

          <div className="relative grid gap-6 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="max-w-xl text-white">
              <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Recherche d&apos;alliés</h1>
              <p className="mt-3 text-sm text-[#ece7ff] sm:text-base">
                Entrez votre code postal et trouvez rapidement des ressources de confiance proches de vous.
              </p>
            </div>

            <form
              onSubmit={onSubmit}
              className="rounded-2xl border border-[#ddd8f0] bg-white/95 p-4 text-[#221a43] shadow-[0_22px_42px_-34px_rgba(23,17,54,0.95)] backdrop-blur-sm"
            >
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Input
                  value={formPostalCode}
                  onChange={(e) => setFormPostalCode(normalizePostalCode(e.target.value))}
                  placeholder="Code postal (H2X ou H2X1Y4)"
                  className="!border-[#d7d3ea] !bg-white !text-[#211a3e] placeholder:!text-[#7a7394] focus:!border-[#3469b9] focus:!ring-[#3469b9]/35"
                />
                <Input
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="Tags (ex: gardien, ménage, tutorat)"
                  className="!border-[#d7d3ea] !bg-white !text-[#211a3e] placeholder:!text-[#7a7394] focus:!border-[#3469b9] focus:!ring-[#3469b9]/35"
                />
                <Button
                  type="submit"
                  disabled={loading || !isPostalCodeValid}
                  className="!rounded-xl !bg-[#3469b9] !px-5 !text-sm !font-semibold !text-white hover:!bg-[#2d5ea8] disabled:!bg-[#a8b8db]"
                >
                  {loading ? "Recherche..." : "Rechercher"}
                </Button>
              </div>
              <p className="mt-3 text-xs text-[#6f688e]">
                Recherche par FSA (3 caracteres, ex: H2X) ou code complet (6 caracteres, ex: H2X1Y4).
              </p>
            </form>
          </div>
        </section>

        {error ? <Alert tone="error">{error}</Alert> : null}

        {data ? (
          <Card className="border-[#d7d2ea] bg-white/95 text-[#2a2349] shadow-[0_16px_36px_-30px_rgba(21,16,49,0.95)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm">
                Total: <strong>{total}</strong> | Page: <strong>{currentPage}</strong> / {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onPreviousPage}
                  disabled={!canGoPrevious}
                  className="!bg-[#ece9fa] !text-[#3e3560] hover:!bg-[#e1ddf5]"
                >
                  Précédent
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onNextPage}
                  disabled={!canGoNext}
                  className="!bg-[#ece9fa] !text-[#3e3560] hover:!bg-[#e1ddf5]"
                >
                  Suivant
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        {isPreview ? (
          <Alert tone="info">
            Mode preview actif: seuls quelques alliés sont visibles. Passe en abonnement actif pour pagination et
            contacts.
          </Alert>
        ) : null}

        {loading ? (
          <section className="grid gap-3">
            {Array.from({ length: skeletonCount }).map((_, index) => (
              <Card
                key={`skeleton-${index}`}
                className="animate-pulse border-[#d7d2ea] bg-white/95 text-[#2a2349] shadow-[0_16px_36px_-30px_rgba(21,16,49,0.95)]"
              >
                <div className="h-5 w-40 rounded bg-[#d9d3ee]" />
                <div className="mt-3 h-4 w-56 rounded bg-[#ece8f8]" />
                <div className="mt-2 h-4 w-64 rounded bg-[#ece8f8]" />
              </Card>
            ))}
          </section>
        ) : null}

        {showEmptyState ? (
          <Card className="border-[#d7d2ea] bg-white/95 text-[#2a2349] shadow-[0_16px_36px_-30px_rgba(21,16,49,0.95)]">
            <p className="text-sm">Aucun resultat pour ce filtre. Essaie un autre code postal ou des tags differents.</p>
          </Card>
        ) : null}

        <section className="grid gap-3">
          {data?.results?.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} isPremiumUser={!data?.limitedPreview} />
          ))}
        </section>
      </div>
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
