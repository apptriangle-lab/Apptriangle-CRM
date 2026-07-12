import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  size?: "sm" | "md";
};

/** Outline toolbar control — avoids shadcn outline hover turning text white. */
export function AttendanceToolbarOutlineButton({
  children,
  className,
  size = "md",
  type = "button",
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 shadow-sm transition-colors",
        "hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "[&_svg]:text-slate-500 hover:[&_svg]:text-slate-700",
        size === "sm" ? "h-8 px-2.5 text-[12px]" : "h-9 px-3 text-[13px]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
