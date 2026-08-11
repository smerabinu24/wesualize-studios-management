"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Live countdown to a task's due date — "2d 4h left", or "3h 12m overdue"
 * once the deadline has passed. Ticks every second inside the final hour
 * (when seconds actually matter) and every minute before that.
 */

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function format(ms: number) {
  const abs = Math.abs(ms);
  if (abs >= DAY) {
    const d = Math.floor(abs / DAY);
    const h = Math.floor((abs % DAY) / HOUR);
    return h ? `${d}d ${h}h` : `${d}d`;
  }
  if (abs >= HOUR) {
    const h = Math.floor(abs / HOUR);
    const m = Math.floor((abs % HOUR) / MIN);
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  const m = Math.floor(abs / MIN);
  const s = Math.floor((abs % MIN) / 1000);
  return m ? `${m}m ${s}s` : `${s}s`;
}

export function DeadlineTimer({
  dueDate,
  done = false,
  className,
}: {
  dueDate: string | Date | null | undefined;
  /** Completed tasks stop counting — no point nagging about a finished job. */
  done?: boolean;
  className?: string;
}) {
  const target = dueDate ? new Date(dueDate).getTime() : null;
  const [now, setNow] = useState(() => Date.now());

  const remaining = target == null ? null : target - now;
  // Inside the last hour (or already overdue) seconds are meaningful.
  const fast = remaining != null && Math.abs(remaining) < HOUR;

  useEffect(() => {
    if (target == null || done) return;
    const id = setInterval(() => setNow(Date.now()), fast ? 1000 : MIN);
    return () => clearInterval(id);
  }, [target, done, fast]);

  if (target == null || remaining == null) return null;
  if (done) return null;

  const overdue = remaining < 0;
  const urgent = !overdue && remaining < DAY;
  const soon = !overdue && remaining < 3 * DAY;

  const Icon = overdue ? AlertTriangle : Clock;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums",
        overdue && "bg-destructive/10 text-destructive",
        urgent && "bg-destructive/10 text-destructive",
        !overdue && !urgent && soon && "bg-warning/10 text-warning",
        !overdue && !urgent && !soon && "text-muted-foreground",
        className
      )}
      // Screen readers get the plain sentence, not the ticking clock.
      aria-label={overdue ? `Overdue by ${format(remaining)}` : `${format(remaining)} remaining`}
      title={new Date(target).toLocaleString()}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {overdue ? `${format(remaining)} overdue` : `${format(remaining)} left`}
    </span>
  );
}
