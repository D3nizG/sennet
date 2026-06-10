import './StatCard.css';

interface StatCardProps {
  value: string | number;
  label: string;
  className?: string;
  highlight?: boolean;
}

export function StatCard({ value, label, className, highlight }: StatCardProps) {
  return (
    <div
      className={[
        'egypt-stat-card',
        highlight ? 'egypt-stat-card--highlight' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="egypt-stat-card__value egypt-display">{value}</span>
      <span className="egypt-stat-card__label egypt-label">{label}</span>
    </div>
  );
}
