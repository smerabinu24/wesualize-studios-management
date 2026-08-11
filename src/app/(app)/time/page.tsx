import { PageHeader } from "@/components/page-header";
import { TimeClient } from "./time-client";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getActiveEntries, getEmployeeTotals, getRecentEntries, getContributions } from "@/lib/time";
import { EmptyState, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { ContributionChart } from "@/components/contribution-chart";
import { Clock } from "lucide-react";

export default async function TimePage() {
  const user = await requireUser();

  if (!user.employeeId) {
    return (
      <div>
        <PageHeader title="Time Tracking" />
        <EmptyState icon={Clock} title="No employee profile" description="This account isn't linked to an employee profile, so time tracking is unavailable." />
      </div>
    );
  }

  const [active, totals, recent, tasks, projects, contributions] = await Promise.all([
    getActiveEntries(user.employeeId),
    getEmployeeTotals(user.employeeId),
    getRecentEntries(user.employeeId),
    // Tasks the user can log against: still-open work they own or collaborate on.
    prisma.task.findMany({
      where: {
        status: { not: "DONE" },
        archivedAt: null,
        OR: [
          { assigneeId: user.employeeId },
          { collaborators: { some: { employeeId: user.employeeId } } },
        ],
      },
      select: { id: true, title: true, project: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
    }),
    // Projects — for logging against a brand-new task inline.
    prisma.project.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getContributions({ employeeId: user.employeeId }),
  ]);

  return (
    <div>
      <PageHeader title="Time Tracking" subtitle="Track time per task with a live timer or by logging hours." />

      {/* Your year at a glance — one square per day, shaded by hours logged. */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Your activity</CardTitle></CardHeader>
        <CardContent>
          <ContributionChart data={contributions.get(user.employeeId)} />
        </CardContent>
      </Card>

      <TimeClient
        initialActive={{
          attendance: active.attendance ? { startedAt: active.attendance.startedAt.toISOString() } : null,
          task: active.task
            ? { startedAt: active.task.startedAt.toISOString(), taskId: active.task.taskId!, taskTitle: active.task.task?.title ?? "Task", projectName: active.task.project?.name ?? "" }
            : null,
        }}
        totals={totals}
        tasks={tasks.map((t) => ({ id: t.id, title: t.title, project: t.project?.name ?? "" }))}
        projects={projects}
        recent={recent.map((e) => ({
          id: e.id,
          kind: e.kind,
          label: e.kind === "TASK" ? e.task?.title ?? "Task" : "Workday",
          project: e.project?.name ?? "",
          note: e.note,
          startedAt: e.startedAt.toISOString(),
          endedAt: e.endedAt!.toISOString(),
        }))}
      />
    </div>
  );
}
