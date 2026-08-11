import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { withAuth, ok } from "@/lib/api";
import { employeeCreateSchema } from "@/lib/validators";
import { can } from "@/lib/rbac";
import { logActivity } from "@/lib/audit";

export const GET = withAuth("analytics:view-team", async (req) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const status = url.searchParams.get("status") || undefined;
  const departmentId = url.searchParams.get("departmentId") || undefined;

  const employees = await prisma.employee.findMany({
    where: {
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { designation: { contains: q, mode: "insensitive" } }] } : {}),
      ...(status ? { status: status as never } : {}),
      ...(departmentId ? { departmentId } : {}),
    },
    include: { department: true, user: { select: { email: true, role: true } }, _count: { select: { projectMemberships: true, tasks: true } } },
    orderBy: { name: "asc" },
  });
  return ok(employees);
});

export const POST = withAuth("employee:manage", async (req, ctx) => {
  const body = employeeCreateSchema.parse(await req.json());
  const passwordHash = await bcrypt.hash(body.password ?? "Password123!", 10);

  const employee = await prisma.employee.create({
    data: {
      name: body.name,
      phone: body.phone ?? undefined,
      designation: body.designation,
      department: body.departmentId ? { connect: { id: body.departmentId } } : undefined,
      status: body.status,
      avatarUrl: body.avatarUrl ?? undefined,
      weeklyCapacityHours: body.weeklyCapacityHours,
      ...(body.weeklyOffDay != null ? { weeklyOffDay: body.weeklyOffDay } : {}),
      // Pay rate is salary data — silently ignored unless the caller can manage finance.
      ...(body.hourlyRate != null && can(ctx.user.role, "finance:manage")
        ? { hourlyRate: body.hourlyRate }
        : {}),
      joiningDate: body.joiningDate ?? undefined,
      user: { create: { email: body.email.toLowerCase(), passwordHash, role: body.role } },
    },
  });
  await logActivity({ userId: ctx.user.id, action: "employee.create", entityType: "Employee", entityId: employee.id });
  return ok(employee, 201);
});
