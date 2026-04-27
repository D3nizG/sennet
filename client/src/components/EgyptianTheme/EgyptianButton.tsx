import './EgyptianButton.css';

interface EgyptianButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  fullWidth?: boolean;
}

export function EgyptianButton({ children, fullWidth, className, ...props }: EgyptianButtonProps) {
  return (
    <button
      className={[
        'egypt-btn',
        'egypt-body',
        fullWidth ? 'egypt-btn--full' : '',
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
