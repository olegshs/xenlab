import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Numeric field: commits valid values immediately without fighting the user while typing. */
export function NumField({
  value,
  onCommit,
  digits = 3,
  step = 'any',
  min,
  max,
  className,
  title,
  ariaLabel,
}: {
  value: number;
  onCommit: (v: number) => void;
  digits?: number;
  step?: number | 'any';
  min?: number;
  max?: number;
  className?: string;
  title?: string;
  ariaLabel?: string;
}) {
  const fmt = (v: number) => (Number.isFinite(v) ? String(Number(v.toFixed(digits))) : '');
  const [text, setText] = useState(fmt(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, digits]);

  return (
    <input
      type="number"
      className={className}
      title={title}
      aria-label={ariaLabel}
      value={text}
      step={step}
      min={min}
      max={max}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        setText(fmt(value));
      }}
      onChange={(e) => {
        setText(e.target.value);
        const v = parseFloat(e.target.value);
        if (Number.isFinite(v) && (min === undefined || v >= min) && (max === undefined || v <= max)) onCommit(v);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'on' : ''}
          title={o.title}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <label className="slider">
      <span className="slider-label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
      <span className="slider-value">{format ? format(value) : value}</span>
    </label>
  );
}

export function Panel({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>{title}</h2>
        {actions}
      </header>
      {children}
    </section>
  );
}

export function download(filename: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const fmtCents = (c: number) => `${c >= 0 ? '+' : '−'}${Math.abs(c).toFixed(1)}`;
