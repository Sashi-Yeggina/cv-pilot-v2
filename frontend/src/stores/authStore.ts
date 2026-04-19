import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  full_name: string;
  tier: 'free' | 'pro' | 'enterprise';
}

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  role: string | null;
  setUser: (user: User | null) => void;
  setIsAuthenticated: (authenticated: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  logout: () => void;
  setToken: (token: string | null) => void;
  setRole: (role: string | null) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  token: null,
  role: null,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setIsAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setToken: (token) => set({ token }),
  setRole: (role) => set({ role }),

  logout: () => set({ user: null, isAuthenticated: false, token: null, role: null }),
}));
