import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { AuthUser } from '../types/models';

const TOKEN_KEY = 'recruitment_token';
const USER_KEY = 'recruitment_user';

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  setAuth: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
  updateUser: (user: AuthUser) => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrated: false,

  setAuth: async (token, user) => {
    await AsyncStorage.multiSet([
      [TOKEN_KEY, token],
      [USER_KEY, JSON.stringify(user)],
    ]);
    set({ token, user });
  },

  updateUser: async (user) => {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user });
  },

  logout: async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    set({ token: null, user: null });
  },

  hydrate: async () => {
    try {
      const [[, token], [, raw]] = await AsyncStorage.multiGet([TOKEN_KEY, USER_KEY]);
      let user: AuthUser | null = null;
      if (raw) {
        try {
          user = JSON.parse(raw) as AuthUser;
        } catch {
          user = null;
        }
      }
      set({ token: token || null, user, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));
