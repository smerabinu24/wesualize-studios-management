import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle, XCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getProjectHealth } from "@/lib/bi";
import { requireCan } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle, Badge, Avatar } from "@/components/ui/primitives";
import { formatDate, currency, daysUntil } from "@/lib/utils";
import { PROJECT_STATUS_LABEL, STATUS_TONE, PRIORITY_TONE, TASK_STATUS_LABEL } from "@/lib/labels";

const PT = PRIORITY_TONE;

export default async function ProjectDetail({ params }: { params: { id: string } }) {
  await requireCan("analytics:view-team");
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      lead: { select: { name: true, avatarUrl: true } },
      members: { include: { employee: { select: { id: true, name: true, designation: true, avatarUrl: true } } } },
      milestones: { orderBy: { dueDate: "asc" } },
      tasks: { include: { assignee: { select: { name: true, avatarUrl: true } } }, orderBy: { dueDate: "asc" } },
    },
  });
  if (!project) notFound();

  const healthList = await getProjectHealth();
  const health = healthList.find((h) => h.id === project.id);
  const dleft = daysUntil(project.deadline);

  const msIcon = { REACHED: CheckCircle2, PENDING: Circle, MISSED: XCircle } as const;
  const msTone = { REACHED: "text-success", PENDING: "text-muted-foreground", MISSED: "text-destructive" } as const;

  return (
    <div className="space-y-6">
      <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to projects
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">{project.name}</h2>
            <Badge tone={STATUS_TONE[project.status]}>{PROJECT_STATUS_LABEL[project.status]}</Badge>
            <Badge tone={PRIORITY_TONE[project.priority]}>{project.priority.toLowerCase()}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{project.client?.companyName ?? project.client?.clientName ?? "Internal"}</p>
        </div>
        {health && (
          <Card className="px-4 py-2">
            <span className="text-xs text-muted-foreground">Health score</span>
            <div className="tabular text-2xl font-bold">{health.healthScore}<span className="text-sm text-muted-foreground">/100</span></div>
          </Card>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Completion</p>
          <p className="tabular text-xl font-bold">{health?.completionRate ?? 0}%</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${health?.completionRate ?? 0}%` }} />
          </div>
        </Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Deadline</p><p className="text-sm font-medium">{formatDate(project.deadline)}</p>
          {dleft != null && project.status !== "COMPLETED" && <p className={`text-xs ${dleft < 0 ? "text-destructive" : "text-muted-foreground"}`}>{dleft < 0 ? `${-dleft}d overdue` : `${dleft}d left`}</p>}
        </Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Budget</p><p className="tabular text-xl font-bold">{currency(project.budget ? Number(project.budget) : null)}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Overdue tasks</p><p className="tabular text-xl font-bold text-destructive">{health?.overdueTasks ?? 0}</p></Card>
      </div>

      {project.description && <Card className="p-5"><p className="text-sm text-muted-foreground">{project.description}</p></Card>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Team</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {project.lead && (
              <div className="flex items-center gap-3">
                <Avatar name={project.lead.name} src={project.lead.avatarUrl} />
                <div><p className="text-sm font-medium">{project.lead.name}</p><p className="text-xs text-muted-foreground">Team Lead</p></div>
              </div>
            )}
            {project.members.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <Avatar name={m.employee.name} src={m.employee.avatarUrl} />
                <div><p className="text-sm font-medium">{m.employee.name}</p><p className="text-xs text-muted-foreground">{m.employee.designation}</p></div>
              </div>
            ))}
            {project.members.length === 0 && <p className="text-sm text-muted-foreground">No members assigned.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Milestones</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {project.milestones.map((m) => {
              const Icon = msIcon[m.status];
              return (
                <div key={m.id} className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${msTone[m.status]}`} />
                  <div className="flex-1"><p className="text-sm font-medium">{m.title}</p><p className="text-xs text-muted-foreground">{formatDate(m.dueDate)}</p></div>
                </div>
              );
            })}
            {project.milestones.length === 0 && <p className="text-sm text-muted-foreground">No milestones.</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Tasks ({project.tasks.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {project.tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.assignee?.name ?? "Unassigned"} · {formatDate(t.dueDate)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge tone={PT[t.priority]}>{t.priority.toLowerCase()}</Badge>
                  <Badge tone="muted">{TASK_STATUS_LABEL[t.status]}</Badge>
                </div>
              </div>
            ))}
            {project.tasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
