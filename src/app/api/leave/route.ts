import { z } from "zod";
import { withAuth, ok } from "@/lib/api";
import { markLeave } from "@/lib/leave";
import { can } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  reason: z.string().max(200).optional(),
  /** Admins may book on someone else's behalf; everyone else books their own. */
  employeeId: z.string().optional(),
});

export const POST = withAuth("leave:manage-own", async (req, ctx) => {
  const body = schema.parse(await req.json());

  // Booking for another person requires the team-management capability.
  const target =
    body.employeeId && can(ctx.user.role, "employee:manage") ? body.employeeId : ctx.user.employeeId;

  if (!target) return ok({ error: "No employee profile linked to this account." }, 400);

  // `date` is a bare YYYY-MM-DD; parse it as local midnight, not UTC, so the
  // day the user picked is the day that gets stored.
  const [y, m, d] = body.date.split("-").map(Number);
  const leave = await markLeave({
    employeeId: target,
    date: new Date(y, m - 1, d),
    reason: body.reason,
    createdById: ctx.user.id,
    // Whoever can approve leave does not need to approve their own entry.
    autoApprove: can(ctx.user.role, "leave:approve"),
  });

  await logActivity({
    userId: ctx.user.id,
    action: "leave.mark",
    entityType: "Leave",
    entityId: leave.id,
    metadata: { type: leave.type, status: leave.status },
  });
  return ok({ ok: true, type: leave.type, status: leave.status }, 201);
});
