import './EgyptianPageShell.css';

interface EgyptianPageShellProps {
  children: React.ReactNode;
  className?: string;
  /** Prevent page scroll — use on fixed-layout pages like the game board */
  noScroll?: boolean;
  /** Vertically + horizontally center all content */
  centerContent?: boolean;
  /** Remove the built-in padding-top that clears the fixed GameHeader */
  noHeader?: boolean;
  backgroundSrc?: string;
}

export function EgyptianPageShell({
  children,
  className,
  noScroll,
  centerContent,
  noHeader,
  backgroundSrc = '/background-water.png',
}: EgyptianPageShellProps) {
  return (
    <div
      className={[
        'egypt-shell',
        noScroll ? 'egypt-shell--no-scroll' : '',
        centerContent ? 'egypt-shell--center' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ backgroundImage: `url('${backgroundSrc}')` }}
    >
      <div className="egypt-shell__overlay" />
      <div className="egypt-shell__vignette" />
      <div
        className="egypt-shell__content"
        style={noHeader ? { paddingTop: 0 } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
