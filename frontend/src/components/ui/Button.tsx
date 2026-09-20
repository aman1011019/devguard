import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand text-brand-ink shadow-glow hover:bg-brand/90 active:bg-brand/95 border border-brand/40",
  secondary:
    "bg-elevated text-ink border border-line hover:border-strong hover:bg-elevated/80",
  ghost: "text-muted hover:text-ink hover:bg-elevated/70 border border-transparent",
  outline: "border border-strong text-ink hover:bg-elevated/60",
  danger: "bg-bad text-white border border-bad/40 hover:bg-bad/90 shadow-card",
  success: "bg-ok text-white border border-ok/40 hover:bg-ok/90 shadow-card",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1.5 px-3 text-xs rounded-lg",
  md: "h-10 gap-2 px-4 text-sm rounded-xl",
  lg: "h-12 gap-2.5 px-5 text-[0.95rem] rounded-xl",
  icon: "h-10 w-10 rounded-xl",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
};

/**
 * The one button in the app. `loading` disables interaction and swaps the icon
 * for a spinner, which is what every real action here needs — the backend work
 * is asynchronous and the user must not be able to double-fire an approval.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", loading = false, icon, children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "relative inline-flex select-none items-center justify-center font-medium tracking-tight",
        "transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-swift",
        "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      ) : icon ? (
        <span className="shrink-0" aria-hidden>
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
});
