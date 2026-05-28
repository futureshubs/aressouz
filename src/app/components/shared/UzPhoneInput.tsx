import { formatUzPhoneLocal, uzPhoneLocalDigits, uzPhoneTo998 } from '../../utils/uzPhoneInput';

type Props = {
  value: string;
  onChange: (value998: string) => void;
  isDark: boolean;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
};

export default function UzPhoneInput({
  value,
  onChange,
  isDark,
  className = '',
  inputClassName = '',
  placeholder = '90 123-45-67',
}: Props) {
  const local = uzPhoneLocalDigits(value);

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${className}`}
      style={{
        background: isDark ? '#111' : '#fff',
        borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
      }}
    >
      <span className="shrink-0 text-sm font-semibold tabular-nums" style={{ opacity: 0.85 }}>
        +998
      </span>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={formatUzPhoneLocal(local)}
        onChange={(e) => onChange(uzPhoneTo998(e.target.value))}
        placeholder={placeholder}
        className={`min-w-0 flex-1 bg-transparent outline-none text-sm ${inputClassName}`}
        style={{ color: isDark ? '#fff' : '#111' }}
      />
    </div>
  );
}
