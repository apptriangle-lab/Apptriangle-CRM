import * as React from "react";
import { cn } from "@/lib/utils";

export interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional message shown below the spinner */
  message?: string;
  /** Spinner size: sm (inline), md (default), lg (full-page) */
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-5 w-5 border-2",
  md: "h-8 w-8 border-2",
  lg: "h-10 w-10 border-[3px]",
};

const messageSizeClasses = {
  sm: "text-xs mt-2",
  md: "text-sm mt-3",
  lg: "text-sm mt-4",
};

export function Loader({ message, size = "md", className, ...props }: LoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message || "Loading"}
      className={cn("flex flex-col items-center justify-center text-center", className)}
      {...props}
    >
      <div
        className={cn(
          "rounded-full border-primary border-t-transparent animate-spin",
          sizeClasses[size]
        )}
      />
      {message && (
        <p className={cn("text-muted-foreground font-medium", messageSizeClasses[size])}>
          {message}
        </p>
      )}
      <span className="sr-only">{message || "Loading"}</span>
    </div>
  );
}

/** Full-page loading block with consistent padding (e.g. for list/detail pages) */
export function LoaderBlock({
  message = "Loading…",
  size = "lg",
  className,
  ...props
}: LoaderProps) {
  return (
    <Loader
      message={message}
      size={size}
      className={cn("py-16 min-h-[200px]", className)}
      {...props}
    />
  );
}
