import { useState, useRef } from 'react';
import { CheckCircle2, Circle, Trash2 } from 'lucide-react';

interface ShoppingItemCardProps {
  name: string;
  quantity?: string;
  observation?: string;
  isCompleted: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

export function ShoppingItemCard({ 
  name, 
  quantity, 
  observation, 
  isCompleted, 
  onToggle,
  onDelete,
  onEdit
}: ShoppingItemCardProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiped, setIsSwiped] = useState(false);
  const touchStartX = useRef(0);
  const longPressTimer = useRef<any>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isCompleted) return;
    touchStartX.current = e.touches[0].clientX;
    
    longPressTimer.current = setTimeout(() => {
      onEdit();
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isCompleted) return;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }

    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartX.current;

    // Permite apenas arrastar para a esquerda (negativo)
    if (diff < 0) {
      if (diff < -90) {
        setOffsetX(-90);
      } else {
        setOffsetX(diff);
      }
    } else {
      setOffsetX(0);
    }
  };

  const handleTouchEnd = () => {
    if (isCompleted) return;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }

    if (offsetX < -45) {
      setOffsetX(-90);
      setIsSwiped(true);
    } else {
      setOffsetX(0);
      setIsSwiped(false);
    }
  };

  const handleClick = () => {
    if (isSwiped) {
      setOffsetX(0);
      setIsSwiped(false);
      return;
    }
    onToggle();
  };

  return (
    <div className={`relative overflow-hidden mb-3 rounded-card ${!isCompleted && offsetX < 0 ? 'bg-red-500' : 'bg-transparent'}`}>
      {/* Botão de exclusão revelado ao arrastar (Aparece apenas se NÃO estiver concluído) */}
      {!isCompleted && (
        <div 
          className="absolute right-0 top-0 bottom-0 w-[90px] flex items-center justify-center text-white font-bold cursor-pointer"
          onClick={onDelete}
        >
          <Trash2 size={22} />
        </div>
      )}

      {/* Cartão principal */}
      <div 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={() => {
          if (!isCompleted) {
            longPressTimer.current = setTimeout(() => onEdit(), 600);
          }
        }}
        onMouseUp={() => {
          if (longPressTimer.current) clearTimeout(longPressTimer.current);
        }}
        onClick={handleClick}
        style={{ transform: `translateX(${isCompleted ? 0 : offsetX}px)` }}
        className={`relative p-4 rounded-card flex items-center justify-between transition-transform duration-200 select-none cursor-pointer ${
          isCompleted ? 'bg-red-300 text-white opacity-90 shadow-none' : 'bg-white shadow-sm'
        }`}
      >
        <div className="flex items-center flex-grow pr-2">
          <div className={`mr-3 flex-shrink-0 ${isCompleted ? 'text-white' : 'text-carrin-primary'}`}>
            {isCompleted ? <CheckCircle2 size={28} /> : <Circle size={28} className="text-gray-300" />}
          </div>
          
          <div className="flex flex-col">
            <span className={`font-semibold text-lg ${isCompleted ? 'text-white line-through' : 'text-carrin-dark'}`}>
              {name}
            </span>
            
            {(quantity || observation) && (
              <div className={`flex flex-wrap gap-2 mt-1 text-xs ${isCompleted ? 'text-white/80' : 'text-gray-500'}`}>
                {quantity && <span>{quantity}</span>}
                {observation && <span className="italic">• {observation}</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}