import type { Contributions } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * GitHub-style activity heatmap: 53 columns (weeks) × 7 rows (days),
 * shaded by hours logged that day. Server-rendered — no client JS needed,
 * the tooltip is a native `title`.
 */

const WEEKS = 53;
const LEVEL_CLASS = [
  "bg-muted",                    // 0 — nothing logged
  "bg-primary/25",               // light
  "bg-primary/45",
  "bg-primary/70",
  "bg-primary",                  // a full day or more
];

/** Hours → intensity bucket. Tuned for an 8h studio day. */
function level(hours: number) {
  if (!hours) return 0;
  if (hours < 2) return 1;
  if (hours < 4) return 2;
  if (hours < 7) return 3;
  return 4;
}

function key(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function ContributionChart({
  data,
  compact = false,
  className,
}: {
  data: Contributions | null | undefined;
  /** Smaller cells, no stat row — for embedding in a team card. */
  compact?: boolean;
  className?: string;
}) {
  const days = data?.days ?? {};

  // Grid ends on the current week's Saturday so the last column is complete.
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + (6 - end.getDay()));

  const start = new Date(end);
  start.setDate(start.getDate() - (WEEKS * 7 - 1));

  const columns: { date: Date; hours: number; future: boolean }[][] = [];
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const cursor = new Date(start);
  for (let w = 0; w < WEEKS; w++) {
    const col: { date: Date; hours: number; future: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(cursor);
      col.push({ date, hours: days[key(date)] ?? 0, future: date > today });
      cursor.setDate(cursor.getDate() + 1);
    }
    columns.push(col);
  }

  const cell = compact ? "h-2 w-2" : "h-2.5 w-2.5";

  // Month labels: mark a column when its first day starts a new month.
  const monthLabels = columns.map((col, i) => {
    const first = col[0].date;
    const prev = i > 0 ? columns[i - 1][0].date : null;
    return prev && first.getMonth() === prev.getMonth() ? null : MONTHS[first.getMonth()];
  });

  return (
    <div className={cn("space-y-2", className)}>
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {!compact && (
            <div className="mb-1 flex gap-[3px] pl-[22px] text-[10px] text-muted-foreground">
              {monthLabels.map((m, i) => (
                <span key={i} className="w-2.5 shrink-0">{m ?? ""}</span>
              ))}
            </div>
          )}
          <div className="flex gap-[3px]">
            {!compact && (
              <div className="mr-1 flex shrink-0 flex-col gap-[3px] text-[10px] leading-[10px] text-muted-foreground">
                {["", "Mon", "", "Wed", "", "Fri", ""].map((l, i) => (
                  <span key={i} className="h-2.5">{l}</span>
                ))}
              </div>
            )}
            {columns.map((col, i) => (
              <div key={i} className="flex shrink-0 flex-col gap-[3px]">
                {col.map((c, j) => (
                  <div
                    key={j}
                    className={cn(
                      cell,
                      "rounded-[2px]",
                      c.future ? "bg-transparent" : LEVEL_CLASS[level(c.hours)]
                    )}
                    title={
                      c.future
                        ? ""
                        : `${c.hours ? `${c.hours.toFixed(2)}h` : "No hours"} on ${c.date.toDateString()}`
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{data?.totalHours.toFixed(1) ?? "0.0"}h</span> over{" "}
            <span className="font-medium text-foreground">{data?.activeDays ?? 0}</span> days
            {data?.currentStreak ? <> · streak <span className="font-medium text-foreground">{data.currentStreak}d</span></> : null}
            {data?.longestStreak ? <> · best <span className="font-medium text-foreground">{data.longestStreak}d</span></> : null}
          </span>
          <span className="flex items-center gap-1">
            Less
            {LEVEL_CLASS.map((c, i) => <span key={i} className={cn("h-2.5 w-2.5 rounded-[2px]", c)} />)}
            More
          </span>
        </div>
      )}
    </div>
  );
}
