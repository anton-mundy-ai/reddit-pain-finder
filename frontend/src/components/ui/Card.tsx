// Card component variants
import { ReactNode, HTMLAttributes } from 'react';
import { Link, LinkProps } from 'react-router-dom';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'glass' | 'bordered' | 'elevated';
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

interface CardLinkProps extends Omit<LinkProps, 'className'> {
  children: ReactNode;
  variant?: 'default' | 'glass' | 'bordered' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
}

const variantClasses = {
  default: 'bg-dark-800 border border-dark-600',
  glass: 'bg-dark-800/50 backdrop-blur-sm border border-dark-600/50',
  bordered: 'bg-transparent border border-dark-600',
  elevated: 'bg-dark-750 border border-dark-500 shadow-lg',
};

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function Card({
  children,
  variant = 'default',
  hover = false,
  padding = 'md',
  className = '',
  ...props
}: CardProps) {
  return (
    <div
      className={`
        rounded-xl
        ${variantClasses[variant]}
        ${paddingClasses[padding]}
        ${hover ? 'transition-all duration-200 cursor-pointer hover:bg-dark-750 hover:border-dark-500 hover:-translate-y-0.5 hover:shadow-lg' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

// Card that's a link
export function CardLink({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  ...props
}: CardLinkProps) {
  return (
    <Link
      className={`
        block rounded-xl
        ${variantClasses[variant]}
        ${paddingClasses[padding]}
        transition-all duration-200 
        hover:bg-dark-750 hover:border-dark-500 hover:-translate-y-0.5 hover:shadow-lg
        focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-dark-900
        ${className}
      `}
      {...props}
    >
      {children}
    </Link>
  );
}

// Card Header
export function CardHeader({ 
  children, 
  className = '',
  action,
}: { 
  children: ReactNode; 
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <div className="flex-1">{children}</div>
      {action && <div className="ml-4">{action}</div>}
    </div>
  );
}

// Card Title
export function CardTitle({ 
  children, 
  className = '',
  subtitle,
}: { 
  children: ReactNode; 
  className?: string;
  subtitle?: ReactNode;
}) {
  return (
    <div className={className}>
      <h3 className="text-lg font-semibold text-white">{children}</h3>
      {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

// Card Footer
export function CardFooter({ 
  children, 
  className = '' 
}: { 
  children: ReactNode; 
  className?: string;
}) {
  return (
    <div className={`mt-4 pt-4 border-t border-dark-600 ${className}`}>
      {children}
    </div>
  );
}

export default Card;
