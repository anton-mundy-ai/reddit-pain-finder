// Button component with variants
import { ReactNode, ButtonHTMLAttributes, forwardRef } from 'react';
import { Link, LinkProps } from 'react-router-dom';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
}

interface ButtonProps extends ButtonBaseProps, ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

interface ButtonLinkProps extends ButtonBaseProps, Omit<LinkProps, 'className'> {
  children: ReactNode;
  external?: boolean;
  className?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-500 active:bg-brand-700 shadow-glow-brand hover:shadow-glow',
  secondary: 'bg-dark-600 text-gray-100 hover:bg-dark-500 active:bg-dark-700',
  ghost: 'bg-transparent text-gray-300 hover:bg-dark-700 hover:text-white',
  outline: 'bg-transparent border border-dark-500 text-gray-300 hover:bg-dark-700 hover:border-dark-400 hover:text-white',
  danger: 'bg-red-600 text-white hover:bg-red-500 active:bg-red-700',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center font-medium rounded-lg
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-dark-900
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : icon}
      {children}
      {iconRight && !loading && iconRight}
    </button>
  );
});

Button.displayName = 'Button';

// Link styled as button
export function ButtonLink({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  fullWidth = false,
  external = false,
  className = '',
  ...props
}: ButtonLinkProps) {
  const classes = `
    inline-flex items-center justify-center font-medium rounded-lg
    transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-dark-900
    ${variantClasses[variant]}
    ${sizeClasses[size]}
    ${fullWidth ? 'w-full' : ''}
    ${className}
  `;

  if (external) {
    return (
      <a
        href={props.to as string}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
      >
        {icon}
        {children}
        {iconRight}
      </a>
    );
  }

  return (
    <Link className={classes} {...props}>
      {icon}
      {children}
      {iconRight}
    </Link>
  );
}

// Icon button
export function IconButton({
  children,
  variant = 'ghost',
  size = 'md',
  className = '',
  ...props
}: Omit<ButtonProps, 'icon' | 'iconRight'>) {
  const sizeClassesIcon: Record<ButtonSize, string> = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-3',
  };

  return (
    <button
      className={`
        inline-flex items-center justify-center rounded-lg
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-dark-900
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClassesIcon[size]}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
