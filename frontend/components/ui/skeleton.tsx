import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular" | "card";
}

export function Skeleton({ className, variant = "rectangular" }: SkeletonProps) {
  const baseClasses = "animate-pulse bg-[#21262d] rounded";

  const variantClasses = {
    text: "h-4 w-full rounded",
    circular: "rounded-full",
    rectangular: "rounded-md",
    card: "h-32 w-full rounded-lg",
  };

  return (
    <div className={cn(baseClasses, variantClasses[variant], className)} />
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("p-6 rounded-lg border border-[#30363d] bg-[#161b22] space-y-4", className)}>
      <Skeleton variant="text" className="h-5 w-1/3" />
      <Skeleton variant="text" className="h-8 w-1/2" />
      <Skeleton variant="text" className="h-4 w-2/3" />
    </div>
  );
}

export function SkeletonChart({ className }: { className?: string }) {
  return (
    <div className={cn("p-6 rounded-lg border border-[#30363d] bg-[#161b22] space-y-4", className)}>
      <Skeleton variant="text" className="h-5 w-1/4" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
