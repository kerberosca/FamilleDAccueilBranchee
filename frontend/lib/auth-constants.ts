"use client";

const IS_DEV = process.env.NODE_ENV !== "production";

/** Refresh token : sessionStorage (prod et dev) pour persistance au F5 sans persister après fermeture du navigateur. */
export const REFRESH_STORAGE_KEY = IS_DEV ? "fab.dev.refresh_token" : "fab.refresh_token";
/** Événement émis quand l’API a renouvelé les tokens (refresh automatique sur 401). */
export const AUTH_TOKENS_EVENT = "fab-auth-tokens";
