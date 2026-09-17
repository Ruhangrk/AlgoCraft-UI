import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/api/endpoints";
import { setTokenGetter } from "@/api/client";
import type { User } from "@/types/api";

const TOKEN_KEY = "algocraft_token";

interface AuthContextValue {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));

  useEffect(() => {
    setTokenGetter(() => token);
  }, [token]);

  const meQuery = useQuery({
    queryKey: ["auth", "me", token],
    queryFn: api.fetchMe,
    enabled: Boolean(token),
    retry: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (meQuery.error) {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
    }
  }, [meQuery.error]);

  const applyAuth = useCallback(
    (nextToken: string) => {
      localStorage.setItem(TOKEN_KEY, nextToken);
      setToken(nextToken);
      void queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
    [queryClient],
  );

  const login = useCallback(
    async (username: string, password: string) => {
      const res = await api.login(username, password);
      applyAuth(res.token);
    },
    [applyAuth],
  );

  const register = useCallback(
    async (username: string, password: string) => {
      const res = await api.register(username, password);
      applyAuth(res.token);
    },
    [applyAuth],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user: meQuery.data ?? null,
      isLoading: Boolean(token) && meQuery.isLoading,
      isAuthenticated: Boolean(token) && Boolean(meQuery.data),
      login,
      register,
      logout,
    }),
    [token, meQuery.data, meQuery.isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
