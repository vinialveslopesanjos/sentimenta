import { createApiClient } from "@sentimenta/api-client";
import * as SecureStore from "expo-secure-store";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://api.sentimenta.com.br/api/v1";

export const TOKEN_KEY = "sentimenta_access_token";
export const REFRESH_KEY = "sentimenta_refresh_token";

let logoutCallback: (() => void) | null = null;

export function setLogoutCallback(cb: () => void) {
  logoutCallback = cb;
}

export const api = createApiClient({
  baseUrl: API_URL,
  getToken: async () => {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  onUnauthorized: () => {
    SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {});
    logoutCallback?.();
  },
});
