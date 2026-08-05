import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null;
  session: Session | null;
  homeId: string | null; // Adicionamos o espaço para a Casa aqui
  setUser: (user: User | null, session: Session | null) => void;
  setHomeId: (id: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  homeId: null,
  setUser: (user, session) => set({ user, session }),
  setHomeId: (id) => set({ homeId: id }),
}))