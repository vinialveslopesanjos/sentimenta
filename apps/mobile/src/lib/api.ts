/// <reference types="vite/client" />
import { createApiClient } from "@sentimenta/api-client";

const API_URL = import.meta.env.VITE_API_URL || "/api/v1";

export function getToken(): string | null {
    return localStorage.getItem("sentimenta_access_token");
}

export function setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem("sentimenta_access_token", accessToken);
    localStorage.setItem("sentimenta_refresh_token", refreshToken);
}

export function clearTokens() {
    localStorage.removeItem("sentimenta_access_token");
    localStorage.removeItem("sentimenta_refresh_token");
}

export const api = createApiClient({
    baseUrl: API_URL,
    getToken: async () => getToken(),
    onUnauthorized: () => {
        clearTokens();
        window.location.href = "/app/login";
    },
});
