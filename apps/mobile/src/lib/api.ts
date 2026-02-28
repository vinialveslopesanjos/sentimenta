/// <reference types="vite/client" />
import { createApiClient } from "@sentimenta/api-client";

const API_URL = import.meta.env.VITE_API_URL || "/api/v1";

export const api = createApiClient({
    baseUrl: API_URL,
    getToken: async () => {
        return localStorage.getItem("sentimenta_access_token");
    },
    onUnauthorized: () => {
        localStorage.removeItem("sentimenta_access_token");
        localStorage.removeItem("sentimenta_refresh_token");
        window.location.href = "/app/login";
    }
});
