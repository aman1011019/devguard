import { cn } from "@/lib/utils";

/** Accessible toggle built on a real checkbox-role button so keyboard and
 *  screen-reader behaviour comes for free. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-between gap-4 py-2.5",
        disabled && "cursor-not-allowed opacity-60",
        className
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-muted">{description}</span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200 ease-swift",
          checked ? "border-brand/50 bg-brand" : "border-line bg-elevated"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 rounded-full bg-white shadow-card transition-transform duration-200 ease-swift gpu",
            checked ? "translate-x-[1.4rem]" : "translate-x-0.5"
          )}
          style={{ height: "1.125rem", width: "1.125rem" }}
        />
      </button>
    </label>
  );
}
