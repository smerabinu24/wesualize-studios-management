import { withAuth, ok } from "@/lib/api";
import { startTask, stopRunningTask } from "@/lib/time";
import { logActivity } from "@/lib/audit";

/** Start or stop a task timer for the signed-in user. Body: { action, taskId? }. */
export const POST = withAuth(null, async (req, ctx) => {
  if (!ctx.user.employeeId) return ok({ error: "No employee profile linked." }, 400);
  const { action, taskId } = await req.json().catch(() => ({}));

  if (action === "start") {
    if (!taskId) return ok({ error: "taskId is required to start a timer." }, 400);
    const entry = await startTask(ctx.user.employeeId, taskId);
    await logActivity({ userId: ctx.user.id, action: "time.task_start", entityType: "Task", entityId: taskId });
    return ok({ ok: true, startedAt: entry.startedAt });
  }

  if (action === "stop") {
    const stopped = await stopRunningTask(ctx.user.employeeId);
    await logActivity({ userId: ctx.user.id, action: "time.task_stop", entityType: "Task", entityId: stopped?.taskId ?? undefined });
    return ok({ ok: true, stopped: Boolean(stopped) });
  }

  return ok({ error: "action must be 'start' or 'stop'." }, 400);
});
