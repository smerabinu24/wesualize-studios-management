import { withAuth, ok } from "@/lib/api";
import { deleteLeave } from "@/lib/leave";
import { can } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";

/** Cancel a recorded leave. Employees may only cancel their own. */
export const DELETE = withAuth("leave:manage-own", async (_req, ctx, params) => {
  const scoped = can(ctx.user.role, "employee:manage")
    ? {}
    : { employeeId: ctx.user.employeeId ?? "__none__" };

  await deleteLeave(params.id, scoped);
  await logActivity({ userId: ctx.user.id, action: "leave.delete", entityType: "Leave", entityId: params.id });
  return ok({ ok: true });
});
