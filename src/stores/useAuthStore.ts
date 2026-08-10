import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null;
  session: Session | null;
  homeId: string | null;
  isRecoveringPassword: boolean;
  setUser: (user: User | null, session: Session | null) => void;
  setHomeId: (id: string | null) => void;
  setIsRecoveringPassword: (isRecovering: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  homeId: null,
  isRecoveringPassword: false,
  setUser: (user, session) => set({ user, session }),
  setHomeId: (id) => set({ homeId: id }),
  setIsRecoveringPassword: (isRecovering) => set({ isRecoveringPassword: isRecovering }),
}))