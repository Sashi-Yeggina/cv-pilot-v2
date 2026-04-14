import { create } from 'zustand';

interface AuthState {
  token: string | null;
  userId: string | null;
  email: string | null;
  role: string | null;

  setAuth: (token: string, userId: string, email: string, role: string) => void;
  logout: () => void;
  isLoggedIn: () => boolean;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  userId: localStorage.getItem('userId'),
  email: localStorage.getItem('email'),
  role: localStorage.getItem('role'),

  setAuth: (token, userId, email, role) => {
    localStorage.setItem('token', token);
    localStorage.setItem('userId', userId);
    localStorage.setItem('email', email);
    localStorage.setItem('role', role);
    set({ token, userId, email, role });
  },

  logout: () => {
    localStorage.clear();
    set({ token: null, userId: null, email: null, role: null });
  },

  isLoggedIn: () => !!localStorage.getItem('token'),
}));
