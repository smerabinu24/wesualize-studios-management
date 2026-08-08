import { z } from "zod";
import { withAuth, ok } from "@/lib/api";
import { logManualTaskTime } from "@/lib/time";
import { logActivity } from "@/lib/audit";

const schema = z.object({
  taskId: z.string().optional(),
  newTaskTitle: z.string().min(2).optional(),
  projectId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  hours: z.coerce.number().positive().max(24),
  note: z.string().max(500).optional(),
});

/** Manually log task time for the signed-in employee (end-of-day entry). */
export const POST = withAuth("task:update-own", async (req, ctx) => {
  if (!ctx.user.employeeId) return ok({ error: "No employee profile linked to this account." }, 400);
  const body = schema.parse(await req.json());
  const entry = await logManualTaskTime(ctx.user.employeeId, body);
  await logActivity({ userId: ctx.user.id, action: "time.log_manual", entityType: "TimeEntry", entityId: entry.id });
  return ok({ ok: true }, 201);
});
