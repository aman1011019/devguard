import { useNavigate } from "react-router-dom";
import { Compass, Home, Radar } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="grid min-h-[60vh] place-items-center" data-rise>
      <div className="panel relative overflow-hidden px-8 py-14 text-center">
        <div className="grid-backdrop pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="relative flex flex-col items-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl border border-line bg-elevated text-brand">
            <Compass className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-5 font-mono text-5xl font-bold tracking-tight text-gradient">404</p>
          <h1 className="mt-2 text-lg font-semibold text-ink">This route drifted off the map</h1>
          <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">
            The page you were after does not exist. Head back to the command center or jump straight
            into an investigation.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            <Button icon={<Home className="h-4 w-4" />} onClick={() => navigate("/")}>
              Command center
            </Button>
            <Button
              variant="outline"
              icon={<Radar className="h-4 w-4" />}
              onClick={() => navigate("/investigate")}
            >
              Investigate
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
