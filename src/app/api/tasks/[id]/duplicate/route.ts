import { prisma } from "@/lib/prisma";
import { withAuth, ok } from "@/lib/api";
import { logActivity } from "@/lib/audit";
import { NotificationType, TaskStatus } from "@prisma/client";

/**
 * Duplicate a task. Copies the definition (title, description, project,
 * assignee, due date, priority, estimate) but NOT the progress — the copy
 * starts fresh at TODO with zero actual hours and no completion date, and
 * it does not inherit the original's time entries.
 */
export const POST = withAuth("task:assign", async (_req, ctx, params) => {
  const src = await prisma.task.findUnique({ where: { id: params.id } });
  if (!src) return ok({ error: "Not found" }, 404);

  const task = await prisma.task.create({
    data: {
      title: `${src.title} (copy)`,
      description: src.description,
      projectId: src.projectId,
      assigneeId: src.assigneeId,
      assignedById: ctx.user.id,
      dueDate: src.dueDate,
      priority: src.priority,
      estimatedHours: src.estimatedHours,
      status: TaskStatus.TODO,
      actualHours: 0,
      completedAt: null,
    },
    include: {
      project: { select: { name: true } },
      assignee: { select: { name: true, avatarUrl: true, userId: true } },
    },
  });

  if (task.assignee?.userId) {
    await prisma.notification.create({
      data: {
        userId: task.assignee.userId,
        type: NotificationType.TASK_ASSIGNED,
        title: `New task: ${task.title}`,
        link: "/tasks",
      },
    });
  }
  await logActivity({
    userId: ctx.user.id,
    action: "task.duplicate",
    entityType: "Task",
    entityId: task.id,
    metadata: { sourceTaskId: src.id },
  });

  return ok(task, 201);
});
