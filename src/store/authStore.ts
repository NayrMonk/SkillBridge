import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  role: 'freelancer' | 'client' | 'admin';
  displayName: string;
  avatarUrl?: string;
  headline?: string;
  bio?: string;
  location?: string;
  hourlyRate?: number;
  isVerified: boolean;
  rating: number;
  reviewCount: number;
  totalEarnings?: number;
  totalSpent?: number;
  availability?: string;
  emailVerified: boolean;
  wallet?: {
    balance: number;
    escrowBalance: number;
  };
  skills?: any[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  updateWallet: (wallet: { balance: number; escrowBalance: number }) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),
      setError: (error) => set({ error }),
      setLoading: (isLoading) => set({ isLoading }),

      login: (user, token) => set({
        user,
        token,
        isAuthenticated: true,
        error: null
      }),

      logout: () => set({
        user: null,
        token: null,
        isAuthenticated: false,
        error: null
      }),

      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null
      })),

      updateWallet: (wallet) => set((state) => ({
        user: state.user ? { ...state.user, wallet } : null
      }))
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated })
    }
  )
);
