import './ParchmentButton.css';

interface ParchmentButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  fullWidth?: boolean;
}

export function ParchmentButton({ children, fullWidth, className, ...props }: ParchmentButtonProps) {
  return (
    <button
      className={[
        'parchment-btn',
        'egypt-display',
        fullWidth ? 'parchment-btn--full' : '',
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
