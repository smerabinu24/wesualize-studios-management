/**
 * Labour costing: what a project actually cost in wages, derived from logged
 * time × each employee's hourly rate.
 *
 * Rates are salary data — every function here is gated behind `finance:view`
 * or `finance:manage` at the call site. Employees without a rate contribute
 * hours but no cost, and are surfaced separately so the number is never
 * silently understated.
 */
import { prisma } from "@/lib/prisma";
import { TimeEntryKind } from "@prisma/client";
import { hoursBetween } from "@/lib/time";

export type ProjectCost = {
  projectId: string;
  projectName: string;
  hours: number;
  cost: number;
  /** Budget from the project record, if one was set. */
  budget: number | null;
  /** People who logged time but have no hourly rate — their hours are uncosted. */
  unratedNames: string[];
  byEmployee: { name: string; hours: number; rate: number | null; cost: number }[];
};

/**
 * Cost breakdown for every project that has logged time.
 * One query, aggregated in memory — the dataset is small (a studio's worth of
 * time entries), and this avoids N+1 round trips to Neon.
 */
export async function getProjectCosts(): Promise<ProjectCost[]> {
  const entries = await prisma.timeEntry.findMany({
    where: { kind: TimeEntryKind.TASK, endedAt: { not: null }, projectId: { not: null } },
    include: {
      employee: { select: { id: true, name: true, hourlyRate: true } },
      project: { select: { id: true, name: true, budget: true } },
    },
  });

  const byProject = new Map<string, ProjectCost & { _people: Map<string, { name: string; hours: number; rate: number | null }> }>();

  for (const e of entries) {
    if (!e.project) continue;
    const hours = hoursBetween(e.startedAt, e.endedAt!);

    let p = byProject.get(e.project.id);
    if (!p) {
      p = {
        projectId: e.project.id,
        projectName: e.project.name,
        hours: 0,
        cost: 0,
        budget: e.project.budget ? Number(e.project.budget) : null,
        unratedNames: [],
        byEmployee: [],
        _people: new Map(),
      };
      byProject.set(e.project.id, p);
    }

    const name = e.employee?.name ?? "Unknown";
    const rate = e.employee?.hourlyRate != null ? Number(e.employee.hourlyRate) : null;
    const key = e.employee?.id ?? name;

    const person = p._people.get(key) ?? { name, hours: 0, rate };
    person.hours += hours;
    p._people.set(key, person);

    p.hours += hours;
    if (rate != null) p.cost += hours * rate;
  }

  return [...byProject.values()]
    .map(({ _people, ...p }) => ({
      ...p,
      hours: Math.round(p.hours * 100) / 100,
      cost: Math.round(p.cost * 100) / 100,
      unratedNames: [..._people.values()].filter((x) => x.rate == null).map((x) => x.name),
      byEmployee: [..._people.values()]
        .map((x) => ({
          name: x.name,
          hours: Math.round(x.hours * 100) / 100,
          rate: x.rate,
          cost: x.rate != null ? Math.round(x.hours * x.rate * 100) / 100 : 0,
        }))
        .sort((a, b) => b.hours - a.hours),
    }))
    .sort((a, b) => b.cost - a.cost);
}

/** Cost for a single project, or null if it has no logged time. */
export async function getProjectCost(projectId: string) {
  const all = await getProjectCosts();
  return all.find((p) => p.projectId === projectId) ?? null;
}
