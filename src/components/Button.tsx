import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function Button({ children, variant = 'primary', ...props }: ButtonProps) {
  // Aqui aplicamos a regra de design: cantos arredondados (rounded-button) e padding confortável
  const baseStyles = "w-full py-4 px-4 rounded-button font-semibold transition-all flex items-center justify-center";
  
  // Nossas três variações oficiais de botão
  const variants = {
    primary: "bg-carrin-primary text-white hover:opacity-90",
    secondary: "bg-carrin-dark text-white hover:opacity-90",
    ghost: "bg-transparent text-carrin-dark hover:bg-gray-100"
  };

  return (
    <button className={`${baseStyles} ${variants[variant]}`} {...props}>
      {children}
    </button>
  );
}