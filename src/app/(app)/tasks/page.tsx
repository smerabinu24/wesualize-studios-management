import { PageHeader } from "@/components/page-header";
import { TasksClient } from "./tasks-client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { Role } from "@prisma/client";

export default async function TasksPage({ searchParams }: { searchParams: { archived?: string } }) {
  const user = await requireUser();
  const isEmployee = user.role === Role.EMPLOYEE;
  const showArchived = searchParams.archived === "1";
  const me = user.employeeId ?? "__none__";

  const [tasks, projects, employees] = await Promise.all([
    prisma.task.findMany({
      where: {
        // Archived work stays out of the board unless explicitly requested.
        archivedAt: showArchived ? { not: null } : null,
        // Employees see what they own *or* collaborate on.
        ...(isEmployee
          ? { OR: [{ assigneeId: me }, { collaborators: { some: { employeeId: me } } }] }
          : {}),
      },
      include: {
        project: { select: { name: true } },
        assignee: { select: { name: true, avatarUrl: true } },
        collaborators: { include: { employee: { select: { id: true, name: true, avatarUrl: true } } } },
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    }),
    prisma.project.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  // Flatten the join rows into a plain list for the client component.
  const shaped = tasks.map((t) => ({
    ...t,
    collaborators: t.collaborators.map((c) => c.employee),
  }));

  return (
    <div>
      <PageHeader
        title={isEmployee ? "My Tasks" : "Tasks"}
        subtitle={
          showArchived
            ? "Archived tasks. Restore anything you still need."
            : isEmployee
              ? "Your assigned work across all projects."
              : "All studio tasks. Drag a card between columns to update progress."
        }
      />
      <TasksClient
        initialTasks={shaped as never}
        projects={projects}
        employees={employees}
        canAssign={can(user.role, "task:assign")}
        showArchived={showArchived}
      />
    </div>
  );
}
