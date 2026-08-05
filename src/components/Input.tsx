import { InputHTMLAttributes, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  rightElement?: ReactNode; // Propriedade nova e opcional
}

export function Input({ label, rightElement, ...props }: InputProps) {
  return (
    <div className="flex flex-col w-full mb-4 text-left">
      <label className="text-sm text-carrin-dark mb-1 ml-1 font-medium">
        {label}
      </label>
      <div className="relative flex items-center w-full">
        <input 
          className={`w-full bg-white text-carrin-dark px-4 py-4 rounded-card border-none shadow-sm outline-none focus:ring-2 focus:ring-carrin-primary transition-all placeholder:text-gray-400 ${rightElement ? 'pr-12' : ''}`}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-4 flex items-center justify-center text-gray-400 hover:text-carrin-primary transition-colors cursor-pointer">
            {rightElement}
          </div>
        )}
      </div>
    </div>
  );
}