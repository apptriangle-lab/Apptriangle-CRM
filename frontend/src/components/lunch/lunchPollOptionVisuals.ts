import { Home, UtensilsCrossed, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type OptionVisual = {
  icon: LucideIcon;
  chipClass: string;
  iconClass: string;
};

const DEFAULT_VISUAL: OptionVisual = {
  icon: UtensilsCrossed,
  chipClass: "bg-orange-100 text-orange-700",
  iconClass: "text-orange-600",
};

const BY_TYPE: Record<string, OptionVisual> = {
  office: DEFAULT_VISUAL,
  personal: {
    icon: UserRound,
    chipClass: "bg-emerald-100 text-emerald-700",
    iconClass: "text-emerald-600",
  },
  off: {
    icon: Home,
    chipClass: "bg-stone-100 text-stone-600",
    iconClass: "text-stone-500",
  },
};

export function getPollOptionVisual(optionType?: string | null): OptionVisual {
  if (!optionType) return DEFAULT_VISUAL;
  return BY_TYPE[optionType] ?? DEFAULT_VISUAL;
}
