import { useRef } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { gsap, reduced } from "@/lib/motion";
import { useTheme, type ThemeChoice } from "@/providers/ThemeProvider";
import { cn } from "@/lib/utils";

const ORDER: ThemeChoice[] = ["light", "dark", "system"];
const ICONS: Record<ThemeChoice, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };
const LABELS: Record<ThemeChoice, string> = {
  light: "Light theme",
  dark: "Dark theme",
  system: "Follow system theme",
};

/** Cycles light → dark → system. The icon spins on change, which makes the
 *  three-state cycle obvious without needing a dropdown. */
export function ThemeToggle({ className }: { className?: string }) {
  const { choice, setChoice } = useTheme();
  const iconRef = useRef<HTMLSpanElement>(null);
  const Icon = ICONS[choice];

  const next = () => {
    const idx = ORDER.indexOf(choice);
    setChoice(ORDER[(idx + 1) % ORDER.length]);
    if (iconRef.current && !reduced()) {
      gsap.fromTo(
        iconRef.current,
        { rotate: -90, scale: 0.7, opacity: 0.2 },
        { rotate: 0, scale: 1, opacity: 1, duration: 0.45, ease: "back.out(2)", overwrite: true }
      );
    }
  };

  return (
    <button
      type="button"
      onClick={next}
      title={LABELS[choice]}
      aria-label={`${LABELS[choice]} — click to change`}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-xl border border-line bg-elevated text-muted",
        "transition-colors duration-200 hover:border-strong hover:text-ink",
        className
      )}
    >
      <span ref={iconRef} className="grid place-items-center gpu">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
    </button>
  );
}
