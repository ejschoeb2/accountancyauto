import { ButtonWithText } from './button-with-text';

interface ToggleOption<T extends string> {
  value: T;
  label: string;
}

interface ToggleGroupProps<T extends string> {
  options: ToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: 'blue' | 'green' | 'red' | 'violet' | 'amber' | 'destructive' | 'ghost' | 'neutral' | 'info' | 'muted' | 'sky';
  disabled?: boolean;
}

export function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
  variant = 'muted',
  disabled = false,
}: ToggleGroupProps<T>) {
  return (
    <div className="flex gap-2 items-center p-2 bg-white rounded-xl shadow-sm border border-gray-200 w-fit">
      {options.map((option) => (
        <ButtonWithText
          key={option.value}
          onClick={() => !disabled && onChange(option.value)}
          isSelected={value === option.value}
          variant={variant}
          disabled={disabled}
        >
          {option.label}
        </ButtonWithText>
      ))}
    </div>
  );
}
