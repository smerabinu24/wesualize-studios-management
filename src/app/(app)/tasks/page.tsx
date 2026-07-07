import { PageHeader } from "@/components/page-header";
import { TasksClient } from "./tasks-client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { Role } from "@prisma/client";

export default async function TasksPage() {
  const user = await requireUser();
  const isEmployee = user.role === Role.EMPLOYEE;

  const [tasks, projects, employees] = await Promise.all([
    prisma.task.findMany({
      where: isEmployee ? { assigneeId: user.employeeId ?? "__none__" } : {},
      include: { project: { select: { name: true } }, assignee: { select: { name: true, avatarUrl: true } } },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    }),
    prisma.project.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        title={isEmployee ? "My Tasks" : "Tasks"}
        subtitle={isEmployee ? "Your assigned work across all projects." : "All studio tasks. Drag status to update progress."}
      />
      <TasksClient
        initialTasks={tasks as never}
        projects={projects}
        employees={employees}
        canAssign={can(user.role, "task:assign")}
      />
    </div>
  );
}
