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

  const tasks = await prisma.task.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      ...(status ? { status: status as never } : {}),
      // Employees only see their own tasks unless they can view the team.
      ...(mine || ctx.user.role === "EMPLOYEE" ? { assigneeId: ctx.user.employeeId ?? "__none__" } : {}),
    },
    include: {
      project: { select: { name: true } },
      assignee: { select: { name: true, avatarUrl: true } },
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
    },
    include: { assignee: { select: { userId: true } } },
  });

  // Notify the assignee.
  if (task.assignee?.userId) {
    await prisma.notification.create({
      data: { userId: task.assignee.userId, type: NotificationType.TASK_ASSIGNED, title: `New task: ${task.title}`, link: `/tasks` },
    });
  }
  await logActivity({ userId: ctx.user.id, action: "task.create", entityType: "Task", entityId: task.id });
  return ok(task, 201);
});
