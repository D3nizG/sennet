import './EgyptianPanel.css';

interface EgyptianPanelProps {
  children: React.ReactNode;
  className?: string;
  ornament?: boolean;
  deep?: boolean;
  soft?: boolean;
}

export function EgyptianPanel({ children, className, ornament, deep, soft }: EgyptianPanelProps) {
  return (
    <div
      className={[
        'egypt-panel',
        deep ? 'egypt-panel--deep' : '',
        soft ? 'egypt-panel--soft' : '',
        ornament ? 'egypt-panel--ornament' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
