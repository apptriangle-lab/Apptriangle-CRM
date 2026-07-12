import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = {
  percent: number;
  selected?: boolean;
};

export function LunchPollProgressBar({ percent, selected = false }: Props) {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div
      className={cn(
        "relative h-1.5 w-full overflow-hidden rounded-full",
        selected ? "bg-orange-100" : "bg-stone-100",
      )}
    >
      <motion.div
        className={cn(
          "absolute inset-y-0 left-0 w-full rounded-full",
          selected
            ? "bg-gradient-to-r from-orange-500 to-amber-500"
            : "bg-gradient-to-r from-orange-300/70 to-amber-300/70",
        )}
        style={{ originX: 0 }}
        initial={false}
        animate={{ scaleX: clamped / 100 }}
        transition={{
          type: "spring",
          stiffness: 160,
          damping: 24,
          mass: 0.7,
        }}
      />
    </div>
  );
}
