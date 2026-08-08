import { withAuth, ok } from "@/lib/api";
import { deleteEntry } from "@/lib/time";
import { logActivity } from "@/lib/audit";

/** Delete one of the signed-in employee's own time entries. */
export const DELETE = withAuth("task:update-own", async (_req, ctx, params) => {
  if (!ctx.user.employeeId) return ok({ error: "No employee profile linked to this account." }, 400);
  await deleteEntry(ctx.user.employeeId, params.id);
  await logActivity({ userId: ctx.user.id, action: "time.entry_deleted", entityType: "TimeEntry", entityId: params.id });
  return ok({ ok: true });
});
