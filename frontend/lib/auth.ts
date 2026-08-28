"use client";

const TOKEN_KEY = "sentiment_access_token";
const REFRESH_KEY = "sentiment_refresh_token";
const SESSION_MARKER_COOKIE = "sentimenta_session";
export const COOKIE_AUTH_SENTINEL = "__sentimenta_cookie_session__";

let memoryAccessToken: string | null = null;
let memoryRefreshToken: string | null = null;

function hasSessionCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .some((part) => part.startsWith(`${SESSION_MARKER_COOKIE}=`));
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  if (memoryAccessToken) return memoryAccessToken;
  if (hasSessionCookie()) return COOKIE_AUTH_SENTINEL;
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  if (memoryRefreshToken) return memoryRefreshToken;
  if (hasSessionCookie()) return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  memoryAccessToken = accessToken;
  memoryRefreshToken = refreshToken;
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  memoryAccessToken = null;
  memoryRefreshToken = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
