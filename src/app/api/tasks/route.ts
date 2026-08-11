import { prisma } from "@/lib/prisma";
import { withAuth, ok } from "@/lib/api";
import { taskCreateSchema } from "@/lib/validators";
import { logActivity } from "@/lib/audit";
import { NotificationType } from "@prisma/client";

export const GET = withAuth("task:update-own", async (req, ctx) => {
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const mine = url.searchParams.get("mine") === "1";
  const archived = url.searchParams.get("archived") === "1";
  const me = ctx.user.employeeId ?? "__none__";

  const tasks = await prisma.task.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      ...(status ? { status: status as never } : {}),
      // Archived work is hidden unless explicitly asked for.
      archivedAt: archived ? { not: null } : null,
      // Employees only see tasks they own or collaborate on.
      ...(mine || ctx.user.role === "EMPLOYEE"
        ? { OR: [{ assigneeId: me }, { collaborators: { some: { employeeId: me } } }] }
        : {}),
    },
    include: {
      project: { select: { name: true } },
      assignee: { select: { name: true, avatarUrl: true } },
      collaborators: { include: { employee: { select: { id: true, name: true, avatarUrl: true } } } },
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });
  return ok(tasks);
});

export const POST = withAuth("task:assign", async (req, ctx) => {
  const body = taskCreateSchema.parse(await req.json());
  const task = await prisma.task.create({
    data: {
      title: body.title,
      description: body.description ?? undefined,
      projectId: body.projectId,
      assigneeId: body.assigneeId ?? undefined,
      assignedById: ctx.user.id,
      dueDate: body.dueDate ?? undefined,
      priority: body.priority,
      status: body.status,
      estimatedHours: body.estimatedHours,
      actualHours: body.actualHours,
      ...(body.collaboratorIds?.length
        ? {
            collaborators: {
              create: body.collaboratorIds
                .filter((id) => id && id !== body.assigneeId)
                .map((employeeId) => ({ employeeId })),
            },
          }
        : {}),
    },
    include: {
      assignee: { select: { userId: true } },
      collaborators: { include: { employee: { select: { userId: true } } } },
    },
  });

  // Notify the primary assignee and every collaborator.
  const recipients = [
    task.assignee?.userId,
    ...task.collaborators.map((c) => c.employee.userId),
  ].filter((id): id is string => Boolean(id));

  if (recipients.length) {
    await prisma.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        type: NotificationType.TASK_ASSIGNED,
        title: `New task: ${task.title}`,
        link: "/tasks",
      })),
    });
  }
  await logActivity({ userId: ctx.user.id, action: "task.create", entityType: "Task", entityId: task.id });
  return ok(task, 201);
});
