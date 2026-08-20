import './ParchmentButton.css';
import { withClickSound } from '../../audio/clickSound';
import type { CueName } from '../../audio/cues';

interface ParchmentButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  fullWidth?: boolean;
  /** Override the default click cue, or pass null for a silent button. */
  soundCue?: CueName | null;
}

export function ParchmentButton({ children, fullWidth, className, soundCue = 'ui-primary', onClick, ...props }: ParchmentButtonProps) {
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
      onClick={withClickSound(soundCue, onClick)}
      {...props}
    >
      {children}
    </button>
  );
}
