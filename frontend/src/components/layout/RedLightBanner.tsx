import { Radio, Smartphone, X } from "lucide-react";
import { useRedLight } from "@/providers/RedLightProvider";

export function RedLightBanner() {
  const { redLightMode, toggleRedLightMode } = useRedLight();

  if (!redLightMode) return null;

  return (
    <aside
      aria-label="Red light mode banner"
      className="relative z-40 border-b border-bad/30 bg-bad/10 backdrop-blur-md px-4 py-2.5 sm:px-6 transition-all duration-300"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bad opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-bad" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-bad">
              RED LIGHT MODE ACTIVE
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 border-l border-bad/30 pl-3">
            <span className="inline-flex items-center gap-1 rounded bg-bad/15 px-2 py-0.5 text-[0.65rem] font-bold tracking-wide uppercase text-bad font-mono">
              <Smartphone className="h-3 w-3" /> PHONE + OFFICE KIT
            </span>
            <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted font-mono">
              NO LAPTOP REQUIRED
            </span>
          </div>

          <p className="text-xs text-muted leading-tight sm:ml-2">
            You can investigate, review evidence, approve fixes and verify incidents from your phone.
          </p>
        </div>

        <button
          type="button"
          onClick={toggleRedLightMode}
          aria-label="Disable Red Light Mode"
          className="shrink-0 rounded-lg p-1 text-muted hover:bg-bad/20 hover:text-bad transition-colors"
          title="Exit Red Light Mode"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
