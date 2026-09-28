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
 *
 * DOM order: label > input + span.track > span.thumb
 * The input is placed BEFORE the track span so that the CSS
 * adjacent-sibling selector `input:checked + .track` works correctly.
 * The input is visually hidden (position: absolute; clip) but remains
 * in the accessibility tree with its real checked state.
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
      {/*
        IMPORTANT: input must come BEFORE the track span in the DOM.
        CSS uses `input:checked + .toggle-switch__track` (adjacent sibling),
        which only selects a sibling that comes immediately AFTER the input.
        Placing input after the track breaks all `:checked` visual states.
      */}
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
      <span className="toggle-switch__track" aria-hidden="true">
        <span className="toggle-switch__thumb" />
      </span>
    </label>
  );
}
