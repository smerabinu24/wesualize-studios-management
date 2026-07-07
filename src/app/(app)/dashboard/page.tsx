import {
  Users, UserCheck, FolderKanban, CheckCircle2, AlertTriangle,
  UserMinus, Layers, CalendarClock, ListChecks, Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/primitives";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { CompletionTrend, WorkloadBars, StatusPie, DepartmentPerformance, UtilizationGauge } from "@/components/dashboard/charts";
import { getDashboardKpis, getDashboardCharts, getTeamUtilization, getRisks } from "@/lib/bi";
import { requireUser } from "@/lib/session";

const riskTone = { high: "destructive", medium: "warning", low: "muted" } as const;

// Shared chart-card hover: softer lift than KPI tiles (no icon pop). 200ms, transform-based.
const cardHover =
  "transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_8px_20px_-8px_rgba(16,24,40,0.16)]";

export default async function DashboardPage() {
  const user = await requireUser();
  const [kpis, charts, util, risks] = await Promise.all([
    getDashboardKpis(),
    getDashboardCharts(),
    getTeamUtilization(),
    getRisks(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Executive Dashboard</h2>
        <p className="text-sm text-muted-foreground">Real-time operational visibility across the studio.</p>
      </div>

      {/* KPI grid */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Key performance indicators">
        <KpiCard label="Total Employees" value={kpis.totalEmployees} icon={Users} />
        <KpiCard label="Active Employees" value={kpis.activeEmployees} icon={UserCheck} tone="success" />
        <KpiCard label="Active Projects" value={kpis.activeProjects} icon={FolderKanban} />
        <KpiCard label="Completed Projects" value={kpis.completedProjects} icon={CheckCircle2} tone="success" />
        <KpiCard label="Delayed Projects" value={kpis.delayedProjects} icon={AlertTriangle} tone="destructive" />
        <KpiCard label="Unassigned" value={kpis.unassignedEmployees} icon={UserMinus} tone="warning" hint="No active project" />
        <KpiCard label="Multi-Project" value={kpis.multiProjectEmployees} icon={Layers} hint="On 2+ projects" />
        <KpiCard label="Done Today" value={kpis.tasksCompletedToday} icon={ListChecks} tone="success" />
        <KpiCard label="Overdue Tasks" value={kpis.overdueTasks} icon={Clock} tone="destructive" />
        <KpiCard label="Due in 7 Days" value={kpis.upcomingDeadlines} icon={CalendarClock} tone="warning" />
      </section>

      {/* Charts */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className={`lg:col-span-2 ${cardHover}`}>
          <CardHeader><CardTitle>Task Completion Trend</CardTitle></CardHeader>
          <CardContent><CompletionTrend data={charts.trend} /></CardContent>
        </Card>
        <Card className={cardHover}>
          <CardHeader><CardTitle>Team Utilization</CardTitle></CardHeader>
          <CardContent>
            <UtilizationGauge pct={util.utilizationPct} />
            <p className="text-center text-xs text-muted-foreground">
              {util.totalAllocated}h allocated of {util.totalCapacity}h · {util.overloadedCount} overloaded
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className={cardHover}>
          <CardHeader><CardTitle>Project Status</CardTitle></CardHeader>
          <CardContent><StatusPie data={charts.statusDistribution} /></CardContent>
        </Card>
        <Card className={cardHover}>
          <CardHeader><CardTitle>Employee Workload</CardTitle></CardHeader>
          <CardContent><WorkloadBars data={charts.workloadChart} /></CardContent>
        </Card>
        <Card className={cardHover}>
          <CardHeader><CardTitle>Department Performance</CardTitle></CardHeader>
          <CardContent><DepartmentPerformance data={charts.departmentPerformance} /></CardContent>
        </Card>
      </section>

      {/* Risk feed */}
      <section>
        <Card className={cardHover}>
          <CardHeader><CardTitle>Risk Detection</CardTitle></CardHeader>
          <CardContent>
            {risks.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No active risks. Everything on track.</p>
            ) : (
              <ul className="divide-y divide-border">
                {risks.map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{r.title}</p>
                        <p className="text-xs text-muted-foreground">{r.detail}</p>
                      </div>
                    </div>
                    <Badge tone={riskTone[r.severity]}>{r.severity}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
