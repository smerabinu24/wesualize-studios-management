import { prisma } from "@/lib/prisma";
import { withAuth, ok } from "@/lib/api";
import { projectCreateSchema } from "@/lib/validators";
import { logActivity } from "@/lib/audit";

export const GET = withAuth("analytics:view-team", async (req) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const status = url.searchParams.get("status") || undefined;

  const projects = await prisma.project.findMany({
    where: {
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      ...(status ? { status: status as never } : {}),
    },
    include: {
      client: { select: { companyName: true, clientName: true } },
      lead: { select: { name: true, avatarUrl: true } },
      _count: { select: { members: true, tasks: true } },
    },
    orderBy: { deadline: "asc" },
  });
  return ok(projects);
});

export const POST = withAuth("project:manage-assigned", async (req, ctx) => {
  const body = projectCreateSchema.parse(await req.json());
  const project = await prisma.project.create({
    data: {
      name: body.name,
      // Passed through as-is: undefined means "not supplied", null means
      // "explicitly empty". Collapsing null to undefined here is what made a
      // blank client arrive as an invalid foreign key.
      description: body.description,
      clientId: body.clientId,
      leadId: body.leadId,
      startDate: body.startDate ?? undefined,
      deadline: body.deadline,
      budget: body.budget,
      status: body.status,
      priority: body.priority,
      members: body.memberIds?.length
        ? { create: body.memberIds.map((employeeId) => ({ employeeId })) }
        : undefined,
    },
  });
  await logActivity({ userId: ctx.user.id, action: "project.create", entityType: "Project", entityId: project.id });
  return ok(project, 201);
});
