import { z } from "zod";
import { withAuth, ok } from "@/lib/api";
import { allotDays } from "@/lib/leave";
import { logActivity } from "@/lib/audit";
import { LeaveKind } from "@prisma/client";

const schema = z.object({
  employeeIds: z.array(z.string()).min(1, "Select at least one person"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid end date").optional(),
  // Only working locations can be allotted — a day off is the employee's to request.
  kind: z.enum([LeaveKind.WORK_FROM_HOME, LeaveKind.WORK_FROM_OFFICE]),
  reason: z.string().max(200).optional(),
});

/** Assign working locations to people across a date range. Administrators only. */
export const POST = withAuth("leave:approve", async (req, ctx) => {
  const body = schema.parse(await req.json());

  // Parse as local midnight so the day the admin picked is the day stored.
  const parse = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const from = parse(body.from);
  const to = parse(body.to ?? body.from);

  if (to < from) return ok({ error: "The end date is before the start date." }, 400);
  if ((to.getTime() - from.getTime()) / 86_400_000 > 92) {
    return ok({ error: "Allot at most three months at a time." }, 400);
  }

  const result = await allotDays({
    employeeIds: body.employeeIds,
    from,
    to,
    kind: body.kind,
    reason: body.reason,
    createdById: ctx.user.id,
  });

  await logActivity({
    userId: ctx.user.id,
    action: "leave.allot",
    entityType: "Leave",
    metadata: { kind: body.kind, from: body.from, to: body.to ?? body.from, ...result },
  });
  return ok({ ok: true, ...result }, 201);
});
