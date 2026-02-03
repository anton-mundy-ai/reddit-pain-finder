// Empty state component
import { ReactNode } from 'react';
import { Button, ButtonLink } from './Button';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  secondaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
  children?: ReactNode;
}

export function EmptyState({
  icon = '📭',
  title,
  description,
  action,
  secondaryAction,
  className = '',
  children,
}: EmptyStateProps) {
  return (
    <div className={`empty-state ${className}`}>
      <div className="empty-state-icon">{icon}</div>
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-description">{description}</p>}
      
      {children}
      
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 mt-6">
          {action && (
            action.href ? (
              <ButtonLink to={action.href} variant="primary">
                {action.label}
              </ButtonLink>
            ) : (
              <Button onClick={action.onClick} variant="primary">
                {action.label}
              </Button>
            )
          )}
          {secondaryAction && (
            secondaryAction.href ? (
              <ButtonLink to={secondaryAction.href} variant="ghost">
                {secondaryAction.label}
              </ButtonLink>
            ) : (
              <Button onClick={secondaryAction.onClick} variant="ghost">
                {secondaryAction.label}
              </Button>
            )
          )}
        </div>
      )}
    </div>
  );
}

// Error state variant
export function ErrorState({
  title = 'Something went wrong',
  description = 'An error occurred while loading this content.',
  onRetry,
  className = '',
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      icon="😕"
      title={title}
      description={description}
      action={onRetry ? { label: 'Try again', onClick: onRetry } : undefined}
      className={className}
    />
  );
}

// Loading state variant (for when you want a bigger loading indicator)
export function LoadingState({
  title = 'Loading...',
  description,
  className = '',
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 text-center ${className}`}>
      <div className="relative mb-6">
        {/* Outer ring with pulse */}
        <div className="w-16 h-16 border-4 border-dark-600 rounded-full animate-pulse"></div>
        {/* Spinning ring */}
        <div className="absolute inset-0 w-16 h-16 border-4 border-brand-500 rounded-full border-t-transparent animate-spin"></div>
        {/* Inner glow */}
        <div className="absolute inset-2 w-12 h-12 bg-brand-500/10 rounded-full animate-pulse"></div>
      </div>
      <h3 className="text-xl font-semibold text-gray-200 mb-2" style={{ animation: 'fadeIn 0.3s ease-out 0.2s both' }}>{title}</h3>
      {description && (
        <p className="text-gray-400 max-w-md" style={{ animation: 'fadeIn 0.3s ease-out 0.3s both' }}>{description}</p>
      )}
    </div>
  );
}

export default EmptyState;
