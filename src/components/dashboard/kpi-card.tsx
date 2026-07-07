import { ArrowUp, ArrowDown } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/**
 * KPI card — visual language ported from 21st.dev "Statistics Card" (reui):
 * muted title, large tracking-tight figure, soft accent icon chip, optional
 * delta badge and a hairline-bordered footer hint.
 */
export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
  delta,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  tone?: "default" | "success" | "warning" | "destructive";
  hint?: string;
  delta?: number;
}) {
  const chip = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  }[tone];

  const deltaPositive = (delta ?? 0) >= 0;

  return (
    <Card
      className={cn(
        "group relative cursor-default overflow-hidden p-5",
        // Motion (ux: transform-based, 200ms, reduced-motion respected globally)
        "transition-all duration-200 ease-out will-change-transform",
        "hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_10px_24px_-8px_rgba(16,24,40,0.18)]"
      )}
    >
      {/* Accent sheen that fades in on hover */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110", chip)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-3 flex items-end gap-2.5">
        <span className="tabular text-3xl font-semibold tracking-tight text-foreground">{value}</span>
        {delta != null && (
          <span
            className={cn(
              "mb-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium",
              deltaPositive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            )}
          >
            {deltaPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>

      {hint && <p className="mt-3 border-t border-border/70 pt-2.5 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
