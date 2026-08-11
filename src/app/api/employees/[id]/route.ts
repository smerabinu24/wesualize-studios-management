import { prisma } from "@/lib/prisma";
import { withAuth, ok } from "@/lib/api";
import { employeeUpdateSchema } from "@/lib/validators";
import { can } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";

export const GET = withAuth("analytics:view-team", async (_req, _ctx, params) => {
  const employee = await prisma.employee.findUnique({
    where: { id: params.id },
    include: {
      department: true,
      user: { select: { email: true, role: true, isActive: true } },
      projectMemberships: { include: { project: true } },
      tasks: { include: { project: { select: { name: true } } }, orderBy: { dueDate: "asc" } },
    },
  });
  if (!employee) return ok({ error: "Not found" }, 404);
  return ok(employee);
});

export const PATCH = withAuth("employee:manage", async (req, ctx, params) => {
  const body = employeeUpdateSchema.parse(await req.json());
  const employee = await prisma.employee.update({
    where: { id: params.id },
    data: {
      name: body.name,
      phone: body.phone ?? undefined,
      designation: body.designation,
      department: body.departmentId ? { connect: { id: body.departmentId } } : undefined,
      status: body.status,
      avatarUrl: body.avatarUrl ?? undefined,
      weeklyCapacityHours: body.weeklyCapacityHours,
      weeklyOffDay: body.weeklyOffDay,
      // Pay rate is salary data — silently ignored unless the caller can manage finance.
      ...(body.hourlyRate !== undefined && can(ctx.user.role, "finance:manage")
        ? { hourlyRate: body.hourlyRate }
        : {}),
      ...(body.role || body.email ? { user: { update: { ...(body.role ? { role: body.role } : {}), ...(body.email ? { email: body.email.toLowerCase() } : {}) } } } : {}),
    },
  });
  await logActivity({ userId: ctx.user.id, action: "employee.update", entityType: "Employee", entityId: employee.id });
  return ok(employee);
});

export const DELETE = withAuth("employee:manage", async (_req, ctx, params) => {
  const employee = await prisma.employee.findUnique({ where: { id: params.id } });
  if (!employee) return ok({ error: "Not found" }, 404);
  // Deleting the user cascades to the employee profile.
  await prisma.user.delete({ where: { id: employee.userId } });
  await logActivity({ userId: ctx.user.id, action: "employee.delete", entityType: "Employee", entityId: params.id });
  return ok({ ok: true });
});
