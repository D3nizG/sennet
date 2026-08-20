import './EgyptianIconButton.css';
import { withClickSound } from '../../audio/clickSound';
import type { CueName } from '../../audio/cues';

interface EgyptianIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Render as a destructive/danger variant */
  danger?: boolean;
  size?: 'sm' | 'md';
  /** Override the default click cue, or pass null for a silent button. */
  soundCue?: CueName | null;
}

export function EgyptianIconButton({ children, danger, size = 'md', className, soundCue = 'ui-secondary', onClick, ...props }: EgyptianIconButtonProps) {
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
      onClick={withClickSound(soundCue, onClick)}
      {...props}
    >
      {children}
    </button>
  );
}
