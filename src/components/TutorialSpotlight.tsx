import { useEffect, useState } from 'react';
import { useTutorialStore, tutorialElements } from '../stores/useTutorialStore';
import { tutorialSteps } from '../features/tutorial/tutorialSteps';
import { preferenceService } from '../services/preferenceService';
import { useAuthStore } from '../stores/useAuthStore';

export function TutorialSpotlight() {
  const { activeTutorial, stepIndex, nextStep, skipTutorial, completeTutorial } = useTutorialStore();
  const { user } = useAuthStore();
  const [rect, setRect] = useState<DOMRect | null>(null);

  const currentSteps = activeTutorial ? tutorialSteps[activeTutorial] : [];
  const currentStep = currentSteps[stepIndex];

  useEffect(() => {
    if (!activeTutorial || !currentStep) return;

    // Busca o elemento no Map silencioso (livre de loops)
    const targetEl = tutorialElements.get(currentStep.targetId);

    if (!targetEl || !document.body.contains(targetEl)) {
      if (stepIndex < currentSteps.length - 1) {
        nextStep();
      } else {
        completeTutorial();
        if (user) preferenceService.markTutorialAsDone(user.id, activeTutorial);
      }
      return;
    }

    try {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {}

    const updateRect = () => {
      if (targetEl && document.body.contains(targetEl)) {
        setRect(targetEl.getBoundingClientRect());
      }
    };

    const timer = setTimeout(updateRect, 350);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [activeTutorial, currentStep, stepIndex, nextStep, completeTutorial, user, currentSteps.length]);

  if (!activeTutorial || !currentStep || !rect) return null;

  const handleAdvance = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (stepIndex >= currentSteps.length - 1) {
      completeTutorial();
      if (user) await preferenceService.markTutorialAsDone(user.id, activeTutorial);
    } else {
      nextStep();
    }
  };

  const handleSkip = async (e: React.MouseEvent) => {
    e.stopPropagation();
    skipTutorial();
    if (user) await preferenceService.markTutorialAsDone(user.id, activeTutorial);
  };

  const padding = 8;
  const top = rect.top - padding;
  const left = rect.left - padding;
  const width = rect.width + padding * 2;
  const height = rect.height + padding * 2;
  const isBottom = rect.top > window.innerHeight / 2;

  return (
    <div 
      className="fixed inset-0 z-[9999] pointer-events-auto"
      onClick={handleAdvance}
    >
      <div 
        className="absolute shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] transition-all duration-300 ease-in-out rounded-xl"
        style={{
          top: Math.max(0, top),
          left: Math.max(0, left),
          width: Math.max(10, width),
          height: Math.max(10, height),
          pointerEvents: 'none'
        }}
      />

      <div 
        className="absolute left-1/2 -translate-x-1/2 w-[90%] max-w-sm transition-all duration-300 pointer-events-auto"
        style={{ top: isBottom ? Math.max(20, top - 150) : top + height + 20 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-white rounded-card p-4 shadow-2xl relative cursor-default border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-between items-start mb-1.5">
            <h3 className="font-extrabold text-carrin-dark text-base">{currentStep.title}</h3>
            <button onClick={handleSkip} className="text-[10px] uppercase text-gray-400 font-bold hover:text-gray-600 transition-colors">
              Pular
            </button>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed mb-4">{currentStep.desc}</p>
          
          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
            <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
              {stepIndex + 1} de {currentSteps.length}
            </span>
            <button onClick={handleAdvance} className="text-xs bg-emerald-600 text-white px-4 py-2 rounded-small font-bold hover:bg-emerald-700 transition-all shadow-sm">
              {stepIndex >= currentSteps.length - 1 ? 'Concluir' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}