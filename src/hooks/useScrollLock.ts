import { useEffect } from 'react';

// Contadores globais para suportar modais empilhados (Stack)
let lockCount = 0;
let originalScrollY = 0;
let originalStyle = '';

export function useScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return;

    // Apenas trava se for o PRIMEIRO modal a abrir
    if (lockCount === 0) {
      originalStyle = window.getComputedStyle(document.body).overflow;
      originalScrollY = window.scrollY;

      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${originalScrollY}px`;
      document.body.style.width = '100%';
    }
    
    lockCount++;

    return () => {
      lockCount--;
      // Apenas destrava se for o ÚLTIMO modal a fechar
      if (lockCount === 0) {
        document.body.style.overflow = originalStyle;
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, originalScrollY);
      }
    };
  }, [isLocked]);
}