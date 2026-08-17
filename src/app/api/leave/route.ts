import { z } from "zod";
import { withAuth, ok } from "@/lib/api";
import { markLeave } from "@/lib/leave";
import { can } from "@/lib/rbac";
import { LeaveKind } from "@prisma/client";
import { logActivity } from "@/lib/audit";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  reason: z.string().max(200).optional(),
  kind: z.nativeEnum(LeaveKind).default(LeaveKind.LEAVE),
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
    kind: body.kind,
    createdById: ctx.user.id,
    // Whoever can approve leave does not need to approve their own entry.
    autoApprove: can(ctx.user.role, "leave:approve"),
  });

  // A change request against an already-settled day leaves `status` alone and
  // parks the proposal in requestedKind, so report that distinctly.
  const changeRequested = leave.requestedKind != null;

  await logActivity({
    userId: ctx.user.id,
    action: changeRequested ? "leave.request_change" : "leave.mark",
    entityType: "Leave",
    entityId: leave.id,
    metadata: { kind: leave.kind, type: leave.type, status: leave.status },
  });
  return ok(
    {
      ok: true,
      kind: leave.kind,
      type: leave.type,
      status: leave.status,
      changeRequested,
      requestedKind: leave.requestedKind,
    },
    201
  );
});
