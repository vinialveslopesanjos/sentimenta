"use client";

import { cn } from "@/lib/utils";
import {
  HTMLAttributes,
  ReactNode,
  forwardRef,
  useCallback,
  useRef,
  useState,
} from "react";

interface TooltipProps extends HTMLAttributes<HTMLDivElement> {
  content: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
}

const positionClasses: Record<string, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

const arrowClasses: Record<string, string> = {
  top: "top-full left-1/2 -translate-x-1/2 border-t-[#21262d] border-x-transparent border-b-transparent",
  bottom:
    "bottom-full left-1/2 -translate-x-1/2 border-b-[#21262d] border-x-transparent border-t-transparent",
  left: "left-full top-1/2 -translate-y-1/2 border-l-[#21262d] border-y-transparent border-r-transparent",
  right:
    "right-full top-1/2 -translate-y-1/2 border-r-[#21262d] border-y-transparent border-l-transparent",
};

const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(
  (
    { className, content, position = "top", delay = 200, children, ...props },
    ref
  ) => {
    const [visible, setVisible] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showTooltip = useCallback(() => {
      timeoutRef.current = setTimeout(() => setVisible(true), delay);
    }, [delay]);

    const hideTooltip = useCallback(() => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setVisible(false);
    }, []);

    return (
      <div
        ref={ref}
        className={cn("relative inline-flex", className)}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        {...props}
      >
        {children}
        {visible && (
          <div
            role="tooltip"
            className={cn(
              "absolute z-50 px-3 py-1.5 text-xs font-medium text-text-primary bg-[#21262d] rounded-md shadow-lg whitespace-nowrap pointer-events-none",
              "animate-in fade-in-0 zoom-in-95 duration-150",
              positionClasses[position]
            )}
          >
            {content}
            <span
              className={cn(
                "absolute border-4",
                arrowClasses[position]
              )}
            />
          </div>
        )}
      </div>
    );
  }
);
Tooltip.displayName = "Tooltip";

export { Tooltip };
export type { TooltipProps };
