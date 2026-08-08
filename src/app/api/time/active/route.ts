import { withAuth, ok } from "@/lib/api";
import { getActiveEntries } from "@/lib/time";

/** Current running entries for the signed-in user (for live timer UI). */
export const GET = withAuth(null, async (_req, ctx) => {
  if (!ctx.user.employeeId) return ok({ attendance: null, task: null });
  const active = await getActiveEntries(ctx.user.employeeId);
  return ok({
    attendance: active.attendance ? { startedAt: active.attendance.startedAt } : null,
    task: active.task
      ? { startedAt: active.task.startedAt, taskId: active.task.taskId, taskTitle: active.task.task?.title, projectName: active.task.project?.name }
      : null,
  });
});
