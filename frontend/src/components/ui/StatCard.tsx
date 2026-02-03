// Stat card component for dashboards
import { ReactNode } from 'react';
import { Card } from './Card';

interface StatCardProps {
  value: string | number;
  label: string;
  sublabel?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    positive?: boolean;
  };
  variant?: 'default' | 'brand' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const variantStyles = {
  default: {
    bg: '',
    value: 'text-white',
    border: '',
  },
  brand: {
    bg: 'bg-brand-500/10',
    value: 'text-brand-300',
    border: 'border-brand-500/30',
  },
  success: {
    bg: 'bg-green-500/10',
    value: 'text-green-300',
    border: 'border-green-500/30',
  },
  warning: {
    bg: 'bg-yellow-500/10',
    value: 'text-yellow-300',
    border: 'border-yellow-500/30',
  },
  danger: {
    bg: 'bg-red-500/10',
    value: 'text-red-300',
    border: 'border-red-500/30',
  },
};

const sizeStyles = {
  sm: {
    padding: 'p-3',
    value: 'text-xl',
    label: 'text-xs',
    sublabel: 'text-2xs',
  },
  md: {
    padding: 'p-4',
    value: 'text-2xl',
    label: 'text-sm',
    sublabel: 'text-xs',
  },
  lg: {
    padding: 'p-6',
    value: 'text-3xl',
    label: 'text-base',
    sublabel: 'text-sm',
  },
};

export function StatCard({
  value,
  label,
  sublabel,
  icon,
  trend,
  variant = 'default',
  size = 'md',
  className = '',
}: StatCardProps) {
  const styles = variantStyles[variant];
  const sizes = sizeStyles[size];

  return (
    <Card
      padding="none"
      className={`
        ${sizes.padding} ${styles.bg} ${styles.border}
        ${className}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className={`font-bold ${sizes.value} ${styles.value} flex items-center gap-2`}>
            {icon && <span className="opacity-80">{icon}</span>}
            {value}
          </div>
          <div className={`text-gray-400 mt-1 ${sizes.label}`}>{label}</div>
          {sublabel && <div className={`text-gray-500 mt-0.5 ${sizes.sublabel}`}>{sublabel}</div>}
        </div>
        {trend && (
          <div className={`
            flex items-center gap-1 text-sm font-medium
            ${trend.positive !== false ? 'text-green-400' : 'text-red-400'}
          `}>
            <span>{trend.positive !== false ? '↑' : '↓'}</span>
            <span>{Math.abs(trend.value)}%</span>
          </div>
        )}
      </div>
    </Card>
  );
}

// Stat grid container
export function StatGrid({ 
  children, 
  cols = 4, 
  className = '' 
}: { 
  children: ReactNode; 
  cols?: 2 | 3 | 4 | 5 | 6 | 7;
  className?: string;
}) {
  const colClasses = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
    7: 'grid-cols-2 md:grid-cols-4 lg:grid-cols-7',
  };

  return (
    <div className={`grid gap-4 ${colClasses[cols]} ${className}`}>
      {children}
    </div>
  );
}

export default StatCard;
