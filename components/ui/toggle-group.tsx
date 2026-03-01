import { cn } from '@/lib/utils';

interface ToggleOption<T extends string> {
  value: T;
  label: string;
}

interface ToggleGroupProps<T extends string> {
  options: ToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: string; // kept for API compatibility
  disabled?: boolean;
}

export function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
}: ToggleGroupProps<T>) {
  return (
    <div className="inline-flex items-center justify-center w-fit rounded-lg bg-muted p-[3px] h-11 text-muted-foreground shrink-0">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => !disabled && onChange(option.value)}
          disabled={disabled}
          className={cn(
            "inline-flex items-center justify-center px-4 rounded-md text-sm font-medium whitespace-nowrap transition-all border border-transparent h-[calc(100%-2px)] disabled:pointer-events-none disabled:opacity-50",
            value === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-foreground/60 hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
