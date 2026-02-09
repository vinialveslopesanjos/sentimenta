"use client";

import { Card } from "@/components/ui/card";

interface Props {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: string;
}

export default function KPICard({ label, value, subtitle, icon, color }: Props) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">{label}</span>
        {icon && (
          <span className={color || "text-text-muted"}>{icon}</span>
        )}
      </div>
      <span className="text-2xl font-bold text-text-primary">{value}</span>
      {subtitle && (
        <span className="text-xs text-text-muted">{subtitle}</span>
      )}
    </Card>
  );
}
