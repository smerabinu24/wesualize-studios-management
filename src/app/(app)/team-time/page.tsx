import Link from "next/link";
import { Clock } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireCan } from "@/lib/session";
import { getTeamTime, getAllEntries, getContributions, type TimeRange } from "@/lib/time";
import { ContributionChart } from "@/components/contribution-chart";
import { Card, CardContent, CardHeader, CardTitle, Avatar, Badge, EmptyState } from "@/components/ui/primitives";
import { Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { cn } from "@/lib/utils";

const RANGES: { key: TimeRange; label: string }[] = [
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
];

export default async function TeamTimePage({ searchParams }: { searchParams: { range?: string } }) {
  await requireCan("analytics:view-team");
  const range = (["week", "month", "all"].includes(searchParams.range ?? "") ? searchParams.range : "week") as TimeRange;
  const [team, entries, contributions] = await Promise.all([
    getTeamTime(range),
    getAllEntries(range),
    getContributions(),
  ]);

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
                {/* Their year of activity, independent of the range filter above. */}
                <div className="mb-3 border-b border-border pb-3">
                  <ContributionChart data={contributions.get(e.id)} compact />
                </div>
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

      {/* Full log — every entry with its summary, readable without exporting. */}
      {entries.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Clock className="h-4 w-4" /> All log entries
            <span className="text-sm font-normal text-muted-foreground">({entries.length})</span>
          </h3>
          <Table>
            <Thead>
              <tr><Th>Employee</Th><Th>Task</Th><Th>Summary</Th><Th>Date</Th><Th className="text-right">Hours</Th></tr>
            </Thead>
            <tbody>
              {entries.map((e) => (
                <Tr key={e.id}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Avatar name={e.employeeName} src={e.avatarUrl} size={22} />
                      <span className="text-sm font-medium">{e.employeeName}</span>
                    </div>
                  </Td>
                  <Td>
                    <span className="text-sm">{e.task}</span>
                    {e.project && <p className="text-xs text-muted-foreground">{e.project}</p>}
                  </Td>
                  <Td className="max-w-sm text-sm text-muted-foreground">
                    {e.note || <span className="italic opacity-60">—</span>}
                  </Td>
                  <Td className="whitespace-nowrap text-sm text-muted-foreground">
                    {e.startedAt.toLocaleDateString([], { month: "short", day: "numeric" })}
                  </Td>
                  <Td className="tabular text-right font-medium">{e.hours.toFixed(2)}h</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
