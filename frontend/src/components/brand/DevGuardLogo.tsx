interface DevGuardLogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
  subtitle?: string;
}

export function DevGuardLogo({
  size = 32,
  showText = false,
  className = "",
  subtitle = "AI Incident Investigator",
}: DevGuardLogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src="/logo.png"
        alt="DevGuard Logo"
        className="rounded-lg object-contain shrink-0 shadow-xs transition-transform duration-200 hover:scale-105"
        style={{ width: size, height: size }}
      />

      {showText && (
        <div className="flex flex-col leading-tight select-none">
          <div className="flex items-center font-extrabold text-base tracking-tight text-slate-900 leading-none">
            <span>Dev</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400">
              Guard
            </span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );
}

