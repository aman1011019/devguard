import type { SVGProps } from "react";

interface DevGuardLogoProps extends SVGProps<SVGSVGElement> {
  size?: number;
  showText?: boolean;
}

export function DevGuardLogo({
  size = 32,
  showText = false,
  className = "",
  ...props
}: DevGuardLogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-300 hover:scale-105"
        {...props}
      >
        <defs>
          <linearGradient id="shieldGrad" x1="15%" y1="0%" x2="85%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="45%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>
          <linearGradient id="shieldFill" x1="50%" y1="5%" x2="50%" y2="95%">
            <stop offset="0%" stopColor="#0f172a" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0.98" />
          </linearGradient>
          <linearGradient id="pulseGrad" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
          <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Shield Outline */}
        <path
          d="M50 8L84 21V48C84 69.5 69.5 87.5 50 93C30.5 87.5 16 69.5 16 48V21L50 8Z"
          fill="url(#shieldFill)"
          stroke="url(#shieldGrad)"
          strokeWidth="4"
          strokeLinejoin="round"
        />

        {/* Inner Shield Accent */}
        <path
          d="M50 14L78 25V47C78 65.5 66 81 50 86C34 81 22 65.5 22 47V25L50 14Z"
          stroke="url(#shieldGrad)"
          strokeWidth="1.5"
          strokeOpacity="0.35"
        />

        {/* Telemetry Bar Graph */}
        <rect x="33" y="52" width="5.5" height="15" rx="1.5" fill="#38bdf8" />
        <rect x="42" y="40" width="5.5" height="27" rx="1.5" fill="#60a5fa" />
        <rect x="51" y="32" width="5.5" height="35" rx="1.5" fill="#38bdf8" />

        {/* Dynamic Cardiac / Latency Pulse Line */}
        <path
          d="M48 57L54 44L61 68L68 53H74"
          stroke="url(#pulseGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#cyanGlow)"
        />
      </svg>

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center tracking-tight font-extrabold text-ink leading-none text-base">
            <span>Dev</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-600">
              Guard
            </span>
          </div>
          <span className="text-[0.6rem] tracking-[0.14em] uppercase text-muted font-mono font-medium mt-0.5">
            Command Center
          </span>
        </div>
      )}
    </div>
  );
}
