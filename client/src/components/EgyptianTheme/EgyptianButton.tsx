import './EgyptianButton.css';

interface EgyptianButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  fullWidth?: boolean;
  danger?: boolean;
}

export function EgyptianButton({ children, fullWidth, danger, className, ...props }: EgyptianButtonProps) {
  return (
    <button
      className={[
        'egypt-btn',
        'egypt-body',
        fullWidth ? 'egypt-btn--full' : '',
        danger ? 'egypt-btn--danger' : '',
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
