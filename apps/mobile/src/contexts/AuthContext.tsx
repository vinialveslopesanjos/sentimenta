import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import * as SecureStore from "expo-secure-store";
import { api, TOKEN_KEY, REFRESH_KEY, setLogoutCallback } from "../lib/api";
import type { UserProfile } from "@sentimenta/types";

interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore logout errors
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    await SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {});
    setState({ user: null, isLoading: false, isAuthenticated: false });
  }, []);

  // Register the logout callback for automatic 401 handling
  useEffect(() => {
    setLogoutCallback(() => {
      setState({ user: null, isLoading: false, isAuthenticated: false });
    });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) {
        setState({ user: null, isLoading: false, isAuthenticated: false });
        return;
      }
      const user = await api.auth.me();
      setState({ user, isLoading: false, isAuthenticated: true });
    } catch {
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const tokens = await api.auth.login(email, password);
      await SecureStore.setItemAsync(TOKEN_KEY, tokens.access_token);
      if (tokens.refresh_token) {
        await SecureStore.setItemAsync(REFRESH_KEY, tokens.refresh_token);
      }
      await refreshUser();
    },
    [refreshUser]
  );

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      const tokens = await api.auth.register(email, password, name);
      await SecureStore.setItemAsync(TOKEN_KEY, tokens.access_token);
      if (tokens.refresh_token) {
        await SecureStore.setItemAsync(REFRESH_KEY, tokens.refresh_token);
      }
      await refreshUser();
    },
    [refreshUser]
  );

  return (
    <AuthContext.Provider
      value={{ ...state, login, register, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
