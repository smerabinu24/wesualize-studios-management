import Link from "next/link";
import { Clock } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireCan } from "@/lib/session";
import { getTeamTime, type TimeRange } from "@/lib/time";
import { Card, CardContent, CardHeader, CardTitle, Avatar, Badge, EmptyState } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const RANGES: { key: TimeRange; label: string }[] = [
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
];

export default async function TeamTimePage({ searchParams }: { searchParams: { range?: string } }) {
  await requireCan("analytics:view-team");
  const range = (["week", "month", "all"].includes(searchParams.range ?? "") ? searchParams.range : "week") as TimeRange;
  const team = await getTeamTime(range);

  const totalTask = team.reduce((s, e) => s + e.taskHours, 0);
  const hasData = team.some((e) => e.entryCount > 0);

  return (
    <div>
      <PageHeader
        title="Team Time"
        subtitle="Hours logged by each employee, broken down by task."
        action={
          <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={`/team-time?range=${r.key}`}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  range === r.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                )}
              >
                {r.label}
              </Link>
            ))}
          </div>
        }
      />

      <div className="mb-4 sm:max-w-xs">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Total task hours</p><p className="tabular text-2xl font-bold">{totalTask.toFixed(1)}h</p></Card>
      </div>

      {!hasData ? (
        <EmptyState icon={Clock} title="No time logged yet" description="Once employees log or track time on their tasks, their hours appear here." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {team.filter((e) => e.entryCount > 0).map((e) => (
            <Card key={e.id}>
              <CardHeader className="flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={e.name} src={e.avatarUrl} size={36} />
                  <CardTitle>{e.name}</CardTitle>
                </div>
                <Badge tone="primary">{e.taskHours.toFixed(1)}h tasks</Badge>
              </CardHeader>
              <CardContent>
                {e.byTask.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No task time logged in this range.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {e.byTask.map((t, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{t.label}</p>
                          {t.project && <p className="text-xs text-muted-foreground">{t.project}</p>}
                        </div>
                        <span className="tabular shrink-0 text-sm font-medium">{t.hours.toFixed(2)}h</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
