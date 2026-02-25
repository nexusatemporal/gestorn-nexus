import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

/**
 * AUTH STORE - Zustand
 * v2.54.0: Auth proprio JWT (sem Clerk)
 */

interface AuthState {
  user: User | null;
  setUser: (user: User) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,

      setUser: (user) => set({ user }),

      clearUser: () => set({ user: null }),
    }),
    {
      name: 'gmnexus-auth',
      partialize: (state) => ({ user: state.user }),
    }
  )
);
