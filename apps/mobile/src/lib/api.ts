/// <reference types="vite/client" />
import { createApiClient } from "@sentimenta/api-client";

const API_URL = import.meta.env.VITE_API_URL || "/api/v1";
const ACCESS_TOKEN_KEY = "sentimenta_access_token";
const REFRESH_TOKEN_KEY = "sentimenta_refresh_token";
const SESSION_MARKER_COOKIE = "sentimenta_session";
const COOKIE_AUTH_SENTINEL = "__sentimenta_cookie_session__";

let memoryAccessToken: string | null = null;

function hasSessionCookie(): boolean {
    if (typeof document === "undefined") return false;
    return document.cookie
        .split(";")
        .map((part) => part.trim())
        .some((part) => part.startsWith(`${SESSION_MARKER_COOKIE}=`));
}

export function getToken(): string | null {
    if (memoryAccessToken) return memoryAccessToken;
    if (hasSessionCookie()) return COOKIE_AUTH_SENTINEL;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
    memoryAccessToken = accessToken;
    void refreshToken;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function clearTokens() {
    memoryAccessToken = null;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export const api = createApiClient({
    baseUrl: API_URL,
    getToken: async () => getToken(),
    cookieAuthSentinel: COOKIE_AUTH_SENTINEL,
    onUnauthorized: () => {
        clearTokens();
        window.location.href = "/app/login";
    },
});
