import { create } from 'zustand';

interface AuthState {
  token: string | null;
  userId: string | null;
  email: string | null;
  role: string | null;

  setAuth: (token: string, userId: string, email: string, role: string, remember: boolean) => void;
  logout: () => void;
  isLoggedIn: () => boolean;
}

// On load, check both storages — localStorage for "remembered" sessions,
// sessionStorage for "this tab only" sessions.
const storedToken =
  localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
const storedUserId =
  localStorage.getItem('userId') || sessionStorage.getItem('userId');
const storedEmail =
  localStorage.getItem('email') || sessionStorage.getItem('email');
const storedRole =
  localStorage.getItem('role') || sessionStorage.getItem('role');

export const useAuthStore = create<AuthState>((set) => ({
  token: storedToken,
  userId: storedUserId,
  email: storedEmail,
  role: storedRole,

  setAuth: (token, userId, email, role, remember) => {
    const storage = remember ? localStorage : sessionStorage;

    // Always clear both so there's no stale entry in the other store
    ['access_token', 'userId', 'email', 'role'].forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });

    storage.setItem('access_token', token);
    storage.setItem('userId', userId);
    storage.setItem('email', email);
    storage.setItem('role', role);

    // Persist the user's "remember" preference so logout knows which store to clear
    localStorage.setItem('remember_me', remember ? '1' : '0');

    set({ token, userId, email, role });
  },

  logout: () => {
    ['access_token', 'userId', 'email', 'role'].forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
    localStorage.removeItem('remember_me');
    set({ token: null, userId: null, email: null, role: null });
  },

  isLoggedIn: () =>
    !!(localStorage.getItem('access_token') || sessionStorage.getItem('access_token')),
}));
