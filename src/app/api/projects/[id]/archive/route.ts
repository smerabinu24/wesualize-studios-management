import { withAuth, ok } from "@/lib/api";
import { projectArchiveSchema } from "@/lib/validators";
import { setProjectArchived } from "@/lib/archive";
import { logActivity } from "@/lib/audit";

/** Archive or restore a project. Non-destructive — see /lib/archive.ts. */
export const POST = withAuth("project:manage", async (req, ctx, params) => {
  const { archived } = projectArchiveSchema.parse(await req.json());
  const project = await setProjectArchived(params.id, archived);
  await logActivity({
    userId: ctx.user.id,
    action: archived ? "project.archive" : "project.restore",
    entityType: "Project",
    entityId: project.id,
  });
  return ok({ ok: true, archivedAt: project.archivedAt });
});
