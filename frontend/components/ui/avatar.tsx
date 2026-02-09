"use client";

import { cn } from "@/lib/utils";
import { HTMLAttributes, forwardRef, useState } from "react";

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg";
  platform?: "youtube" | "instagram" | null;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const platformRingColors: Record<string, string> = {
  youtube: "ring-[#FF0000]",
  instagram: "ring-[#E4405F]",
};

const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  (
    { className, src, alt = "", fallback, size = "md", platform, ...props },
    ref
  ) => {
    const [imgError, setImgError] = useState(false);
    const showImage = src && !imgError;
    const initials = fallback ? getInitials(fallback) : alt ? getInitials(alt) : "?";

    const ringClass = platform ? platformRingColors[platform] : null;

    return (
      <div
        ref={ref}
        className={cn(
          "relative inline-flex items-center justify-center rounded-full bg-surface-hover text-text-secondary font-medium overflow-hidden shrink-0",
          ringClass && `ring-2 ${ringClass}`,
          {
            "h-8 w-8 text-xs": size === "sm",
            "h-10 w-10 text-sm": size === "md",
            "h-12 w-12 text-base": size === "lg",
          },
          className
        )}
        {...props}
      >
        {showImage ? (
          <img
            src={src}
            alt={alt}
            onError={() => setImgError(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="select-none">{initials}</span>
        )}
      </div>
    );
  }
);
Avatar.displayName = "Avatar";

export { Avatar };
export type { AvatarProps };
