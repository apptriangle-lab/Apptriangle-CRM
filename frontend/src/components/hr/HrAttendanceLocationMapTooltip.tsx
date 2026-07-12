import { MapPin } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Props = {
  coordinates: string;
  variant: "check-in" | "check-out";
  locationLabel: string;
  children: React.ReactNode;
};

export function HrAttendanceLocationMapTooltip({
  coordinates,
  variant,
  locationLabel,
  children,
}: Props) {
  const coords = coordinates.split(",").map((c) => c.trim());
  if (coords.length !== 2) {
    return <>{children}</>;
  }

  const [lat, lng] = coords;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(lng) - 0.01},${parseFloat(lat) - 0.01},${parseFloat(lng) + 0.01},${parseFloat(lat) + 0.01}&layer=mapnik&marker=${lat},${lng}`;
  const isCheckIn = variant === "check-in";
  const title = isCheckIn ? "Check in location" : "Check out location";

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={6}
        align="start"
        className="z-[99999] max-w-none border-0 bg-transparent p-0 shadow-none"
      >
        <div
          className={cn(
            "relative h-[280px] w-[360px] overflow-hidden rounded-xl border-2 bg-white shadow-2xl",
            isCheckIn ? "border-emerald-500/20" : "border-orange-500/20",
          )}
        >
          <div
            className={cn(
              "pointer-events-none absolute inset-0 z-10 bg-gradient-to-br to-transparent",
              isCheckIn ? "from-emerald-500/5" : "from-orange-500/5",
            )}
          />
          <div className="absolute left-2 top-2 z-20 rounded-md border border-slate-200/80 bg-white/95 px-2 py-1 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-1.5">
              <MapPin className={cn("h-3.5 w-3.5", isCheckIn ? "text-emerald-600" : "text-orange-600")} />
              <span className="text-xs font-medium text-slate-800">{title}</span>
            </div>
            <p className="mt-0.5 max-w-[320px] truncate text-[11px] text-slate-500">{locationLabel}</p>
          </div>
          <iframe
            width="100%"
            height="100%"
            frameBorder={0}
            scrolling="no"
            src={mapUrl}
            className="relative z-0 h-full w-full"
            title={title}
          />
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
