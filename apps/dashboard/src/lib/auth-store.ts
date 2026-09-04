import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, Tenant, AuthTokens, JWTPayload } from '@repo/shared-types';

interface AuthState {
  user: (User & { tenantName: string }) | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  initialize: () => Promise<void>;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function parseJWT(token: string): JWTPayload | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      isLoading: true,

      initialize: async () => {
        const storedTokens = get().tokens;
        if (!storedTokens) {
          set({ isLoading: false });
          return;
        }

        try {
          const payload = parseJWT(storedTokens.accessToken);
          if (!payload || payload.exp * 1000 < Date.now()) {
            await get().refreshAccessToken();
          } else {
            const res = await fetch(`${API_URL}/auth/me`, {
              headers: { Authorization: `Bearer ${storedTokens.accessToken}` },
            });
            if (res.ok) {
              const user = await res.json();
              set({ user: { ...user, tenantName: '' }, isLoading: false });
            } else {
              await get().refreshAccessToken();
            }
          }
        } catch {
          set({ user: null, tokens: null, isLoading: false });
        }
      },

      login: async (email: string, password: string, rememberMe = false) => {
        set({ isLoading: true });
        const res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, rememberMe }),
        });

        if (!res.ok) {
          const error = await res.json().catch(() => ({ message: 'Error de autenticación' }));
          set({ isLoading: false });
          throw new Error(error.message);
        }

        const { user, tokens } = await res.json();
        set({ user: { ...user, tenantName: '' }, tokens, isLoading: false });
      },

      logout: () => {
        set({ user: null, tokens: null });
        fetch(`${API_URL}/auth/logout`, { method: 'POST' }).catch(() => {});
      },

      refreshAccessToken: async () => {
        const { tokens } = get();
        if (!tokens?.refreshToken) {
          set({ user: null, tokens: null, isLoading: false });
          return;
        }

        try {
          const res = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: tokens.refreshToken }),
          });

          if (!res.ok) throw new Error('Token expirado');

          const newTokens = await res.json();
          set({ tokens: { ...tokens, ...newTokens } });

          const payload = parseJWT(newTokens.accessToken);
          if (payload) {
            const res = await fetch(`${API_URL}/auth/me`, {
              headers: { Authorization: `Bearer ${newTokens.accessToken}` },
            });
            if (res.ok) {
              const user = await res.json();
              set({ user: { ...user, tenantName: '' } });
            }
          }
        } catch {
          set({ user: null, tokens: null });
        } finally {
          set({ isLoading: false });
        }
      },

      hasPermission: (permission: string) => {
        const { user } = get();
        if (!user) return false;
        if (user.role === 'OWNER') return true;
        if (user.role === 'SUPERVISOR') return true;
        return false;
      },
    }),
    {
      name: 'wms-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({ tokens: state.tokens }),
    }
  )
);