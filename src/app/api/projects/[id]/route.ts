import { prisma } from "@/lib/prisma";
import { withAuth, ok } from "@/lib/api";
import { projectUpdateSchema } from "@/lib/validators";
import { logActivity } from "@/lib/audit";

export const GET = withAuth("analytics:view-team", async (_req, _ctx, params) => {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      lead: { select: { id: true, name: true, avatarUrl: true } },
      members: { include: { employee: { select: { id: true, name: true, designation: true, avatarUrl: true } } } },
      milestones: { orderBy: { dueDate: "asc" } },
      tasks: { include: { assignee: { select: { name: true, avatarUrl: true } } }, orderBy: { dueDate: "asc" } },
    },
  });
  if (!project) return ok({ error: "Not found" }, 404);
  return ok(project);
});

export const PATCH = withAuth("project:manage-assigned", async (req, ctx, params) => {
  const body = projectUpdateSchema.parse(await req.json());

  // If memberIds provided, replace the membership set.
  if (body.memberIds) {
    await prisma.projectMember.deleteMany({ where: { projectId: params.id } });
    await prisma.projectMember.createMany({
      data: body.memberIds.map((employeeId) => ({ projectId: params.id, employeeId })),
      skipDuplicates: true,
    });
  }

  const project = await prisma.project.update({
    where: { id: params.id },
    data: {
      name: body.name,
      description: body.description ?? undefined,
      clientId: body.clientId ?? undefined,
      leadId: body.leadId ?? undefined,
      startDate: body.startDate ?? undefined,
      deadline: body.deadline ?? undefined,
      budget: body.budget ?? undefined,
      status: body.status,
      priority: body.priority,
    },
  });
  await logActivity({ userId: ctx.user.id, action: "project.update", entityType: "Project", entityId: project.id, metadata: { status: body.status } });
  return ok(project);
});

export const DELETE = withAuth("project:manage", async (_req, ctx, params) => {
  await prisma.project.delete({ where: { id: params.id } });
  await logActivity({ userId: ctx.user.id, action: "project.delete", entityType: "Project", entityId: params.id });
  return ok({ ok: true });
});
