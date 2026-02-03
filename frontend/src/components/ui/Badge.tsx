// Badge component with variants
import { ReactNode } from 'react';

type BadgeVariant = 'brand' | 'blue' | 'green' | 'yellow' | 'orange' | 'red' | 'gray' | 'purple' | 'cyan';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: ReactNode;
  className?: string;
  dot?: boolean;
  pulse?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  brand: 'bg-brand-500/20 text-brand-300 border-brand-500/30',
  blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  green: 'bg-green-500/20 text-green-300 border-green-500/30',
  yellow: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  orange: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  red: 'bg-red-500/20 text-red-300 border-red-500/30',
  gray: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  purple: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  cyan: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-2xs',
  md: 'px-2 py-0.5 text-xs',
  lg: 'px-3 py-1 text-sm',
};

const dotColors: Record<BadgeVariant, string> = {
  brand: 'bg-brand-400',
  blue: 'bg-blue-400',
  green: 'bg-green-400',
  yellow: 'bg-yellow-400',
  orange: 'bg-orange-400',
  red: 'bg-red-400',
  gray: 'bg-gray-400',
  purple: 'bg-purple-400',
  cyan: 'bg-cyan-400',
};

export function Badge({ 
  children, 
  variant = 'gray', 
  size = 'md',
  icon,
  className = '',
  dot = false,
  pulse = false,
}: BadgeProps) {
  return (
    <span 
      className={`
        inline-flex items-center gap-1.5 font-medium rounded-full border
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {dot && (
        <span className={`
          w-1.5 h-1.5 rounded-full 
          ${dotColors[variant]}
          ${pulse ? 'animate-pulse-soft' : ''}
        `} />
      )}
      {icon}
      {children}
    </span>
  );
}

// Severity badge preset
export function SeverityBadge({ severity, size = 'md' }: { severity: string; size?: BadgeSize }) {
  const config: Record<string, { variant: BadgeVariant; icon: string }> = {
    critical: { variant: 'red', icon: '🔴' },
    high: { variant: 'orange', icon: '🟠' },
    medium: { variant: 'yellow', icon: '🟡' },
    low: { variant: 'green', icon: '🟢' },
  };
  
  const { variant, icon } = config[severity] || { variant: 'gray' as BadgeVariant, icon: '⚪' };
  
  return (
    <Badge variant={variant} size={size}>
      {icon} {severity}
    </Badge>
  );
}

// Market tier badge preset
export function MarketTierBadge({ tier, size = 'md' }: { tier: string; size?: BadgeSize }) {
  const config: Record<string, BadgeVariant> = {
    '$10B+': 'purple',
    '$1B': 'purple',
    '$100M': 'blue',
    '$10M': 'cyan',
    '$1M': 'gray',
  };
  
  return (
    <Badge variant={config[tier] || 'gray'} size={size}>
      💰 {tier}
    </Badge>
  );
}

// Status badge preset
export function StatusBadge({ status, size = 'md' }: { status: string; size?: BadgeSize }) {
  const config: Record<string, { variant: BadgeVariant; icon: string; label: string }> = {
    hot: { variant: 'red', icon: '🔥', label: 'Hot' },
    rising: { variant: 'green', icon: '📈', label: 'Rising' },
    stable: { variant: 'gray', icon: '➖', label: 'Stable' },
    cooling: { variant: 'blue', icon: '📉', label: 'Cooling' },
    cold: { variant: 'purple', icon: '❄️', label: 'Cold' },
  };
  
  const { variant, icon, label } = config[status] || { variant: 'gray' as BadgeVariant, icon: '⚪', label: status };
  
  return (
    <Badge variant={variant} size={size}>
      {icon} {label}
    </Badge>
  );
}

// Category badge preset
export function CategoryBadge({ category, size = 'md' }: { category: string; size?: BadgeSize }) {
  const config: Record<string, BadgeVariant> = {
    productivity: 'blue',
    finance: 'green',
    crm: 'purple',
    email: 'yellow',
    dev: 'cyan',
    design: 'orange',
    scheduling: 'red',
    forms: 'brand',
    analytics: 'red',
  };
  
  return (
    <Badge variant={config[category] || 'gray'} size={size}>
      {category}
    </Badge>
  );
}

export default Badge;
