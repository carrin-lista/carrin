import { create } from 'zustand';

export type TutorialScreen = 'list' | 'history' | 'home' | 'settings';

// VARIÁVEL EXTERNA: Guarda os elementos sem causar re-renderizações no React! (Adeus, loop infinito)
export const tutorialElements = new Map<string, HTMLElement>();

interface TutorialState {
  activeTutorial: TutorialScreen | null;
  stepIndex: number;
  registerElement: (id: string, el: HTMLElement | null) => void;
  startTutorial: (screen: TutorialScreen) => void;
  nextStep: () => void;
  skipTutorial: () => void;
  completeTutorial: () => void;
}

export const useTutorialStore = create<TutorialState>((set) => ({
  activeTutorial: null,
  stepIndex: 0,
  registerElement: (id, el) => {
    // Apenas salva/remove da memória do navegador silenciosamente. Não atualiza estado.
    if (el) {
      tutorialElements.set(id, el);
    } else {
      tutorialElements.delete(id);
    }
  },
  startTutorial: (screen) => set({ activeTutorial: screen, stepIndex: 0 }),
  nextStep: () => set((state) => ({ stepIndex: state.stepIndex + 1 })),
  skipTutorial: () => set({ activeTutorial: null, stepIndex: 0 }),
  completeTutorial: () => set({ activeTutorial: null, stepIndex: 0 })
}));