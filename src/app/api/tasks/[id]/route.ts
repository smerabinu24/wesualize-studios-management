import { prisma } from "@/lib/prisma";
import { withAuth, ok } from "@/lib/api";
import { taskUpdateSchema } from "@/lib/validators";
import { logActivity } from "@/lib/audit";
import { TaskStatus } from "@prisma/client";

export const PATCH = withAuth("task:update-own", async (req, ctx, params) => {
  const body = taskUpdateSchema.parse(await req.json());

  const existing = await prisma.task.findUnique({ where: { id: params.id } });
  if (!existing) return ok({ error: "Not found" }, 404);

  // Employees may only update tasks assigned to them.
  if (ctx.user.role === "EMPLOYEE" && existing.assigneeId !== ctx.user.employeeId) {
    return ok({ error: "Forbidden" }, 403);
  }

  const completing = body.status === TaskStatus.DONE && existing.status !== TaskStatus.DONE;
  const reopening = body.status && body.status !== TaskStatus.DONE && existing.status === TaskStatus.DONE;

  const task = await prisma.task.update({
    where: { id: params.id },
    data: {
      title: body.title,
      description: body.description ?? undefined,
      assigneeId: body.assigneeId ?? undefined,
      dueDate: body.dueDate ?? undefined,
      priority: body.priority,
      status: body.status,
      estimatedHours: body.estimatedHours,
      actualHours: body.actualHours,
      ...(completing ? { completedAt: new Date() } : {}),
      // Reopening also un-archives, otherwise the task would vanish from the board.
      ...(reopening ? { completedAt: null, archivedAt: null } : {}),
      ...(body.archived !== undefined ? { archivedAt: body.archived ? new Date() : null } : {}),
      ...(body.collaboratorIds
        ? {
            collaborators: {
              deleteMany: {},
              create: body.collaboratorIds
                .filter((id) => id && id !== body.assigneeId)
                .map((employeeId) => ({ employeeId })),
            },
          }
        : {}),
    },
  });
  await logActivity({ userId: ctx.user.id, action: "task.update", entityType: "Task", entityId: task.id, metadata: { status: task.status } });
  return ok(task);
});

export const DELETE = withAuth("task:assign", async (_req, ctx, params) => {
  await prisma.task.delete({ where: { id: params.id } });
  await logActivity({ userId: ctx.user.id, action: "task.delete", entityType: "Task", entityId: params.id });
  return ok({ ok: true });
});
