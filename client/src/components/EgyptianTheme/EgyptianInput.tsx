import './EgyptianInput.css';

interface EgyptianInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function EgyptianInput({ label, className, id, ...props }: EgyptianInputProps) {
  return (
    <div className="egypt-input-wrap">
      {label && (
        <label className="egypt-label" htmlFor={id}>
          {label}
        </label>
      )}
      <input id={id} className={`egypt-input ${className ?? ''}`} {...props} />
    </div>
  );
}
