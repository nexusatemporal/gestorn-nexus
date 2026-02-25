import { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { useUIStore } from '@/stores/useUIStore';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
}: ModalProps) {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full mx-4',
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        className={cn(
          'relative w-full rounded-lg shadow-xl',
          isDark ? 'bg-zinc-900' : 'bg-white',
          sizes[size]
        )}
      >
        {(title || showCloseButton) && (
          <div className={cn(
            'flex items-center justify-between px-6 py-4 border-b',
            isDark ? 'border-zinc-800' : 'border-gray-200'
          )}>
            {title && (
              <h3 className={cn(
                'text-lg font-semibold',
                isDark ? 'text-white' : 'text-gray-900'
              )}>{title}</h3>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className={cn(
                  'transition-colors',
                  isDark ? 'text-zinc-400 hover:text-zinc-200' : 'text-gray-400 hover:text-gray-600'
                )}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        )}
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

export interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  const { theme } = useUIStore();
  const isDark = theme === 'dark';

  return (
    <div
      className={cn(
        'flex items-center justify-end gap-3 px-6 py-4 border-t',
        isDark ? 'border-zinc-800 bg-zinc-800/50' : 'border-gray-200 bg-gray-50',
        className
      )}
    >
      {children}
    </div>
  );
}
