import './EgyptianIconButton.css';

interface EgyptianIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Render as a destructive/danger variant */
  danger?: boolean;
  size?: 'sm' | 'md';
}

export function EgyptianIconButton({ children, danger, size = 'md', className, ...props }: EgyptianIconButtonProps) {
  return (
    <button
      className={[
        'egypt-icon-btn',
        `egypt-icon-btn--${size}`,
        danger ? 'egypt-icon-btn--danger' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </button>
  );
}
