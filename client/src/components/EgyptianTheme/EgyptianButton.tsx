import './EgyptianButton.css';
import { withClickSound } from '../../audio/clickSound';
import type { CueName } from '../../audio/cues';

interface EgyptianButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  fullWidth?: boolean;
  danger?: boolean;
  /** Override the default click cue, or pass null for a silent button. */
  soundCue?: CueName | null;
}

export function EgyptianButton({ children, fullWidth, danger, className, soundCue = 'ui-secondary', onClick, ...props }: EgyptianButtonProps) {
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
      onClick={withClickSound(soundCue, onClick)}
      {...props}
    >
      {children}
    </button>
  );
}
