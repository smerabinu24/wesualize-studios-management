import { PageHeader } from "@/components/page-header";
import { ProjectsClient } from "./projects-client";
import { prisma } from "@/lib/prisma";
import { getProjectHealth } from "@/lib/bi";
import { requireCan } from "@/lib/session";
import { can } from "@/lib/rbac";
import { Role } from "@prisma/client";

export default async function ProjectsPage() {
  const user = await requireCan("analytics:view-team");
  const [projects, healthList, clients, leads] = await Promise.all([
    prisma.project.findMany({
      // Archived projects drop off the active list but are never deleted.
      where: { archivedAt: null },
      include: {
        client: { select: { companyName: true, clientName: true } },
        lead: { select: { name: true } },
        _count: { select: { members: true, tasks: true } },
      },
      orderBy: { deadline: "asc" },
    }).then((rows) =>
      // Decimal and Date are not serialisable across the server/client
      // boundary, so hand the form plain values it can drop into inputs.
      rows.map((p) => ({
        ...p,
        budget: p.budget != null ? Number(p.budget) : null,
        deadline: p.deadline ? p.deadline.toISOString() : null,
      }))
    ),
    getProjectHealth(),
    prisma.client.findMany({ select: { id: true, companyName: true, clientName: true } }),
    prisma.employee.findMany({ where: { user: { role: { in: [Role.TEAM_LEAD, Role.ADMIN] } } }, select: { id: true, name: true } }),
  ]);
  const health = Object.fromEntries(healthList.map((h) => [h.id, h]));

  return (
    <div>
      <PageHeader title="Projects" subtitle="Track production status, health and deadlines." />
      <ProjectsClient
        projects={projects as never}
        health={health}
        clients={clients.map((c) => ({ id: c.id, name: c.companyName ?? c.clientName }))}
        leads={leads}
        canManage={can(user.role, "project:manage-assigned")}
      />
    </div>
  );
}
