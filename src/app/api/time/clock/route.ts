import { withAuth, ok } from "@/lib/api";
import { toggleClock } from "@/lib/time";
import { logActivity } from "@/lib/audit";

/** Toggle the signed-in user's workday clock (in / out). */
export const POST = withAuth(null, async (_req, ctx) => {
  if (!ctx.user.employeeId) return ok({ error: "No employee profile linked." }, 400);
  const entry = await toggleClock(ctx.user.employeeId);
  const clockedIn = entry.endedAt === null;
  await logActivity({ userId: ctx.user.id, action: clockedIn ? "time.clock_in" : "time.clock_out" });
  return ok({ ok: true, clockedIn });
});
