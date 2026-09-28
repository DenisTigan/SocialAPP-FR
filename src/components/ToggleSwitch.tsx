import '../styles/settings.css';

interface ToggleSwitchProps {
  /** The visible label for the toggle */
  label: string;
  /** Whether the toggle is currently ON */
  checked: boolean;
  /** Called when the user clicks the toggle */
  onChange: (checked: boolean) => void;
  /** When true the toggle is non-interactive and visually dimmed */
  disabled?: boolean;
  /** Optional id for the input element (defaults to a slugified label) */
  id?: string;
}

/**
 * ToggleSwitch — Accessible toggle switch using a real checkbox.
 * Uses role="switch" so screen readers announce ON/OFF state.
 */
export default function ToggleSwitch({
  label,
  checked,
  onChange,
  disabled = false,
  id,
}: ToggleSwitchProps) {
  const inputId = id ?? `toggle-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <label
      htmlFor={inputId}
      className={`toggle-switch${disabled ? ' toggle-switch--disabled' : ''}`}
    >
      <span className="toggle-switch__label">{label}</span>
      <span className="toggle-switch__track" aria-hidden="true">
        <span className="toggle-switch__thumb" />
      </span>
      <input
        id={inputId}
        type="checkbox"
        role="switch"
        className="toggle-switch__input"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        aria-checked={checked}
      />
    </label>
  );
}
