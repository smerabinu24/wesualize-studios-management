import { z } from "zod";
import { withAuth, ok } from "@/lib/api";
import { decideLeave } from "@/lib/leave";
import { logActivity } from "@/lib/audit";

const schema = z.object({
  approve: z.boolean(),
  note: z.string().max(200).optional(),
});

/** Approve or reject an employee's leave request. Administrators only. */
export const POST = withAuth("leave:approve", async (req, ctx, params) => {
  const { approve, note } = schema.parse(await req.json());
  const leave = await decideLeave({ id: params.id, approve, decidedById: ctx.user.id, note });

  await logActivity({
    userId: ctx.user.id,
    action: approve ? "leave.approve" : "leave.reject",
    entityType: "Leave",
    entityId: leave.id,
  });
  return ok({ ok: true, status: leave.status });
});
