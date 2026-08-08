import { PageHeader } from "@/components/page-header";
import { TimeClient } from "./time-client";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getActiveEntries, getEmployeeTotals, getRecentEntries } from "@/lib/time";
import { EmptyState } from "@/components/ui/primitives";
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

  const [active, totals, recent, tasks] = await Promise.all([
    getActiveEntries(user.employeeId),
    getEmployeeTotals(user.employeeId),
    getRecentEntries(user.employeeId),
    // Tasks the user can log against: their assigned, still-open tasks.
    prisma.task.findMany({
      where: { assigneeId: user.employeeId, status: { not: "DONE" } },
      select: { id: true, title: true, project: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader title="Time Tracking" subtitle="Clock your workday and track time per task." />
      <TimeClient
        initialActive={{
          attendance: active.attendance ? { startedAt: active.attendance.startedAt.toISOString() } : null,
          task: active.task
            ? { startedAt: active.task.startedAt.toISOString(), taskId: active.task.taskId!, taskTitle: active.task.task?.title ?? "Task", projectName: active.task.project?.name ?? "" }
            : null,
        }}
        totals={totals}
        tasks={tasks.map((t) => ({ id: t.id, title: t.title, project: t.project?.name ?? "" }))}
        recent={recent.map((e) => ({
          id: e.id,
          kind: e.kind,
          label: e.kind === "TASK" ? e.task?.title ?? "Task" : "Workday",
          project: e.project?.name ?? "",
          startedAt: e.startedAt.toISOString(),
          endedAt: e.endedAt!.toISOString(),
        }))}
      />
    </div>
  );
}
