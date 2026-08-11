import { PageHeader } from "@/components/page-header";
import { EmployeesClient } from "./employees-client";
import { prisma } from "@/lib/prisma";
import { getEmployeeWorkload } from "@/lib/bi";
import { requireCan } from "@/lib/session";
import { can } from "@/lib/rbac";

export default async function EmployeesPage() {
  const user = await requireCan("analytics:view-team");
  const [employees, workloadList, departments] = await Promise.all([
    prisma.employee.findMany({
      include: { department: true, user: { select: { email: true, role: true } } },
      orderBy: { name: "asc" },
    }),
    getEmployeeWorkload(),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);
  const workload = Object.fromEntries(workloadList.map((w) => [w.id, w]));
  const canManageFinance = can(user.role, "finance:manage");

  // hourlyRate is salary data. Strip it from the payload entirely for anyone
  // without finance:manage — hiding it in the UI alone would still ship the
  // number to the browser.
  const safeEmployees = employees.map(({ hourlyRate, ...e }) => ({
    ...e,
    ...(canManageFinance ? { hourlyRate: hourlyRate != null ? Number(hourlyRate) : null } : {}),
  }));

  return (
    <div>
      <PageHeader title="Employees" subtitle="Manage the team, monitor workload and assignments." />
      <EmployeesClient
        employees={safeEmployees as never}
        workload={workload}
        departments={departments}
        canManage={can(user.role, "employee:manage")}
        canManageFinance={canManageFinance}
      />
    </div>
  );
}
