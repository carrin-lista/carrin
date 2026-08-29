import { create } from 'zustand';

interface PwaState {
  updateAvailable: boolean;
  availableVersion: string | null;
  applyUpdate: () => void;
  setUpdateAvailable: (available: boolean, version: string | null, updateFn: () => void) => void;
}

export const usePwaStore = create<PwaState>((set) => ({
  updateAvailable: false,
  availableVersion: null,
  applyUpdate: () => {},
  setUpdateAvailable: (available, version, updateFn) => 
    set({ updateAvailable: available, availableVersion: version, applyUpdate: updateFn }),
}));