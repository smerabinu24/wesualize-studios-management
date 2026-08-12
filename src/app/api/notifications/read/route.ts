import { withAuth, ok } from "@/lib/api";
import { markAllRead } from "@/lib/alerts";

/** Mark every unread notification for the signed-in user as read. */
export const POST = withAuth("task:update-own", async (_req, ctx) => {
  const { count } = await markAllRead(ctx.user.id);
  return ok({ ok: true, count });
});
