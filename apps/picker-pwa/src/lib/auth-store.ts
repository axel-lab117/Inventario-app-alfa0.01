'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'OWNER' | 'SUPERVISOR' | 'EMPLOYEE' | 'VIEWER';
  avatarUrl?: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  tenantId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  initialize: () => Promise<void>;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  setTenantId: (tenantId: string) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      tenantId: null,
      isLoading: true,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        const response = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Credenciales inválidas');
        }

        const data = await response.json();
        const { accessToken, refreshToken, user, tenant } = data;

        localStorage.setItem('refreshToken', refreshToken);
        set({
          user: { ...user, tenantId: tenant.id, tenantName: tenant.name, tenantSlug: tenant.slug },
          token: accessToken,
          tenantId: tenant.id,
          isAuthenticated: true,
        });
      },

      logout: () => {
        localStorage.removeItem('refreshToken');
        set({ user: null, token: null, tenantId: null, isAuthenticated: false });
      },

      initialize: async () => {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          set({ isLoading: false });
          return;
        }

        try {
          const response = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (!response.ok) throw new Error('Token expirado');

          const data = await response.json();
          const { accessToken, user, tenant } = data;

          set({
            user: { ...user, tenantId: tenant.id, tenantName: tenant.name, tenantSlug: tenant.slug },
            token: accessToken,
            tenantId: tenant.id,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          localStorage.removeItem('refreshToken');
          set({ isLoading: false });
        }
      },

      setUser: (user) => set({ user }),
      setToken: (token) => set({ token }),
      setTenantId: (tenantId) => set({ tenantId }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        tenantId: state.tenantId,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);