import { useState, useRef, useEffect } from 'react';
import { CheckCircle2, Circle, Trash2, User, MoreHorizontal, Edit2, Tag, X } from 'lucide-react';

const CATEGORIES = [
  '🛒 Mantimentos', '🍎 Hortifrúti', '🥩 Açougue', '🥛 Laticínios',
  '🧹 Limpeza', '🧴 Higiene', '🍺 Bebidas', '🐶 Pet',
  '👶 Bebê', '🏠 Utilidades', '📦 Outros'
];

interface ShoppingItemCardProps {
  name: string;
  quantity?: string;
  observation?: string;
  isCompleted: boolean;
  isMarketMode?: boolean; 
  creatorAvatar?: string | null;
  creatorName?: string | null;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onUpdateCategory?: (newCategory: string) => void;
}

export function ShoppingItemCard({ 
  name, 
  quantity, 
  observation, 
  isCompleted, 
  isMarketMode = false, 
  creatorAvatar,
  creatorName,
  onToggle,
  onDelete,
  onEdit,
  onUpdateCategory
}: ShoppingItemCardProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [isSwipedLeft, setIsSwipedLeft] = useState(false);
  const [isSwipedRight, setIsSwipedRight] = useState(false);
  
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);
  const swipeDirection = useRef<'left' | 'right' | null>(null);
  const longPressTimer = useRef<any>(null);

  // Estados dos Menus e Card
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [isMovingCategory, setIsMovingCategory] = useState(false);
  const [showDesktopMenu, setShowDesktopMenu] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Detecta se é um ambiente Desktop (Mouse/Pointer preciso)
  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        closeActions();
      }
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeActions();
    };
    
    if (showActionMenu || isMovingCategory || offsetX !== 0 || showDesktopMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleEsc);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [showActionMenu, isMovingCategory, offsetX, showDesktopMenu]);

  const closeActions = () => {
    setShowActionMenu(false);
    setIsMovingCategory(false);
    setShowDesktopMenu(false);
    setOffsetX(0);
    setIsSwipedRight(false);
    setIsSwipedLeft(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isCompleted || showActionMenu || isMovingCategory || isSwipedLeft || isSwipedRight || showDesktopMenu) return;
    
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
    swipeDirection.current = null;
    
    longPressTimer.current = setTimeout(() => {
      onEdit();
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isCompleted || showActionMenu || isMovingCategory || isSwipedLeft || isSwipedRight || showDesktopMenu) return;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);

    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchCurrentX.current - touchStartX.current;

    if (!swipeDirection.current) {
      if (diff > 10) swipeDirection.current = 'right';
      else if (diff < -10) swipeDirection.current = 'left';
      else return; 
    }

    if (swipeDirection.current === 'right') {
      setOffsetX(Math.max(0, Math.min(diff, 90))); 
    } else if (swipeDirection.current === 'left') {
      setOffsetX(Math.min(0, Math.max(diff, -90))); 
    }
  };

  const handleTouchEnd = () => {
    if (isCompleted || showActionMenu || isMovingCategory || isSwipedLeft || isSwipedRight || showDesktopMenu) return;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);

    if (swipeDirection.current === 'left' && offsetX < -45) {
      setOffsetX(-90);
      setIsSwipedLeft(true);
    } else if (swipeDirection.current === 'right' && offsetX > 45) {
      setOffsetX(90);
      setIsSwipedRight(true);
    } else {
      setOffsetX(0);
      setIsSwipedLeft(false);
      setIsSwipedRight(false);
    }
    
    swipeDirection.current = null;
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isSwipedLeft || isSwipedRight || showActionMenu || isMovingCategory || showDesktopMenu) {
      closeActions();
      return;
    }
    
    // NOVO: Menu Contextual Desktop (Apenas se for mouse)
    if (isDesktop && !isMarketMode && !isCompleted) {
      setShowDesktopMenu(true);
      return;
    }

    if (!isMarketMode && !isCompleted) return;
    onToggle();
  };

  return (
    <div ref={cardRef} className={`relative overflow-visible mb-3 rounded-card ${!isCompleted && offsetX < 0 ? 'bg-red-500' : !isCompleted && offsetX > 0 ? 'bg-gray-100' : 'bg-transparent'}`}>
      
      {/* Camada Lixeira (Direita) */}
      {!isCompleted && offsetX < 0 && (
        <div 
          className="absolute right-0 top-0 bottom-0 w-[90px] flex items-center justify-center text-white font-bold cursor-pointer"
          onClick={onDelete}
        >
          <Trash2 size={22} />
        </div>
      )}

      {/* Camada Ícone 3 Pontinhos (Esquerda) */}
      {!isCompleted && offsetX > 0 && !showActionMenu && !isMovingCategory && (
        <div 
          className="absolute left-0 top-0 bottom-0 w-[90px] flex items-center justify-center text-gray-500 hover:text-gray-700 cursor-pointer"
          onClick={(e) => { 
            e.stopPropagation(); 
            setOffsetX(135); 
            setShowActionMenu(true); 
          }}
        >
          <MoreHorizontal size={28} />
        </div>
      )}

      {/* Card Deslizante */}
      <div 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={() => {
          if (!isCompleted && !showActionMenu && !isMovingCategory && !isSwipedLeft && !isSwipedRight && !showDesktopMenu && !isDesktop) {
            longPressTimer.current = setTimeout(() => onEdit(), 600);
          }
        }}
        onMouseUp={() => {
          if (longPressTimer.current) clearTimeout(longPressTimer.current);
        }}
        onClick={handleClick}
        style={{ transform: `translateX(${isCompleted ? 0 : offsetX}px)` }}
        className={`relative p-4 rounded-card flex items-center justify-between transition-all duration-200 select-none ${
          (isMarketMode || isCompleted || isDesktop) ? 'cursor-pointer' : 'cursor-default'
        } ${
          isCompleted ? 'bg-red-300 text-white opacity-90 shadow-none' : 'bg-white shadow-sm'
        } ${!isCompleted && isDesktop ? 'lg:hover:bg-gray-50' : ''} ${isMovingCategory ? 'opacity-30 pointer-events-none' : ''}`}
      >
        <div className="flex items-center flex-grow pr-2 overflow-hidden">
          
          {(!isCompleted && !isMarketMode) ? null : (
            <div className={`mr-3 flex-shrink-0 ${isCompleted ? 'text-white' : 'text-carrin-primary'}`}>
              {isCompleted ? <CheckCircle2 size={28} /> : <Circle size={28} className="text-gray-300" />}
            </div>
          )}
          
          <div className="flex flex-col flex-grow pr-2 overflow-hidden">
            <span className={`font-semibold text-lg truncate ${isCompleted ? 'text-white line-through' : 'text-carrin-dark'}`}>
              {name}
            </span>
            
            {(quantity || observation) && (
              <div className={`flex flex-wrap gap-2 mt-1 text-xs ${isCompleted ? 'text-white/80' : 'text-gray-500'}`}>
                {quantity && <span className="truncate max-w-[80px]">{quantity}</span>}
                {observation && <span className="italic truncate flex-1">• {observation}</span>}
              </div>
            )}
          </div>

          <div className="flex-shrink-0 ml-2 self-start pt-0.5" title={`Adicionado por ${creatorName || 'Morador'}`}>
            {creatorAvatar ? (
              <img 
                src={creatorAvatar} 
                alt={creatorName || 'Avatar'} 
                className={`w-5 h-5 rounded-full object-cover border shadow-sm ${isCompleted ? 'border-white/40' : 'border-gray-200'}`} 
              />
            ) : (
              <div className={`w-5 h-5 rounded-full flex items-center justify-center border text-[9px] font-bold ${isCompleted ? 'bg-white/20 border-white/40 text-white' : 'bg-gray-100 border-gray-200 text-gray-500'}`}>
                {creatorName ? creatorName.charAt(0).toUpperCase() : <User size={10} />}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NOVO: Menu Contextual Desktop */}
      {showDesktopMenu && (
        <div className="absolute right-4 top-[80%] bg-white border border-gray-200 shadow-xl rounded-card p-1.5 flex flex-col gap-1 z-30 min-w-[150px] animate-in fade-in zoom-in-95 duration-150">
          <button 
            onClick={(e) => { e.stopPropagation(); closeActions(); onEdit(); }}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 rounded-lg transition-colors text-left"
          >
            <Edit2 size={16} /> Editar item
          </button>
          <div className="h-px bg-gray-100 w-full my-0.5"></div>
          <button 
            onClick={(e) => { e.stopPropagation(); closeActions(); onDelete(); }}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left"
          >
            <Trash2 size={16} /> Excluir item
          </button>
        </div>
      )}

      {/* MENUS FLUTUANTES EXISTENTES (FIXOS NA RAIZ) */}
      {showActionMenu && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 bg-white border border-gray-200 shadow-md rounded-xl p-1.5 flex gap-1 z-30 animate-in fade-in zoom-in-95 duration-150">
          <button 
            onClick={(e) => { e.stopPropagation(); closeActions(); onEdit(); }}
            className="flex flex-col items-center justify-center w-[52px] h-[48px] rounded-lg bg-gray-50 hover:bg-emerald-50 hover:text-emerald-700 text-gray-600 transition-colors"
          >
            <Edit2 size={16} className="mb-1" />
            <span className="text-[9px] font-bold uppercase tracking-tight">Editar</span>
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setShowActionMenu(false); setIsMovingCategory(true); }}
            className="flex flex-col items-center justify-center w-[52px] h-[48px] rounded-lg bg-gray-50 hover:bg-emerald-50 hover:text-emerald-700 text-gray-600 transition-colors"
          >
            <Tag size={16} className="mb-1" />
            <span className="text-[9px] font-bold uppercase tracking-tight">Mover</span>
          </button>
        </div>
      )}

      {isMovingCategory && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 bg-white border border-gray-200 shadow-xl rounded-card p-2 flex items-center gap-2 z-30 animate-in fade-in zoom-in-95 duration-150 w-[240px] max-w-[85vw]">
          <select
            autoFocus
            className="flex-1 w-full bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-xs font-semibold text-carrin-dark focus:outline-none focus:border-emerald-500"
            onChange={(e) => {
              if (onUpdateCategory) onUpdateCategory(e.target.value);
              closeActions();
            }}
            defaultValue=""
          >
            <option value="" disabled>Nova categoria...</option>
            {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <button onClick={(e) => { e.stopPropagation(); closeActions(); }} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-full shrink-0">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}