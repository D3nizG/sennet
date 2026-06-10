import './MedallionIcon.css';

interface MedallionIconProps {
  children?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  accentColor?: string;
}

export function MedallionIcon({ children, size = 'md', className, accentColor }: MedallionIconProps) {
  return (
    <div
      className={`medallion-icon medallion-icon--${size} ${className ?? ''}`}
      style={accentColor ? ({ '--medallion-accent': accentColor } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
