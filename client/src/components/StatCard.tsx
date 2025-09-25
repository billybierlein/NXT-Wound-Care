import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  title, value, subtitle, icon, tint = "green"
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  tint?: "green" | "blue";
}) {
  const tints = {
    green: { bg: "bg-emerald-50", text: "text-emerald-700", chip: "text-emerald-600" },
    blue:  { bg: "bg-blue-50",    text: "text-blue-700",    chip: "text-blue-600" },
  } as const;
  const c = tints[tint];

  return (
    <div className={cn("rounded-3xl px-4 py-3 border shadow-sm min-w-[220px]", c.bg)}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <div className={cn("text-sm font-medium", c.text)}>{title}</div>
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      {subtitle ? <div className={cn("text-xs mt-1", c.chip)}>{subtitle}</div> : null}
    </div>
  );
}