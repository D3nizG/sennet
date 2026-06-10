import './SectionTitle.css';

interface SectionTitleProps {
  children: React.ReactNode;
  className?: string;
  sub?: string;
  align?: 'left' | 'center';
}

export function SectionTitle({ children, className, sub, align = 'center' }: SectionTitleProps) {
  return (
    <div className={`section-title section-title--${align} ${className ?? ''}`}>
      <h2 className="section-title__text egypt-heading">{children}</h2>
      {sub && <p className="section-title__sub egypt-muted">{sub}</p>}
      <div className="gold-divider" />
    </div>
  );
}
