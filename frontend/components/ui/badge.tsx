"use client";

import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error" | "info" | "outline";
  size?: "sm" | "md";
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", size = "sm", ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center font-medium rounded-full transition-colors",
          {
            "bg-surface-hover text-text-secondary border border-border":
              variant === "default",
            "bg-positive/10 text-positive": variant === "success",
            "bg-neutral/10 text-neutral": variant === "warning",
            "bg-negative/10 text-negative": variant === "error",
            "bg-[rgba(88,166,255,0.1)] text-[#58a6ff]": variant === "info",
            "bg-transparent text-text-secondary border border-border":
              variant === "outline",
          },
          {
            "px-2 py-0.5 text-xs": size === "sm",
            "px-2.5 py-1 text-sm": size === "md",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge };
export type { BadgeProps };
