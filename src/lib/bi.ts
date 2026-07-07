/**
 * Smart Business Intelligence engine.
 * Centralized, testable calculations used by the dashboard, reports and risk feed.
 */
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { ProjectStatus, TaskStatus, EmployeeStatus } from "@prisma/client";

export const WORKLOAD_THRESHOLD = Number(process.env.WORKLOAD_THRESHOLD ?? 6);

const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = [
  ProjectStatus.PLANNING,
  ProjectStatus.IN_PROGRESS,
  ProjectStatus.REVIEW,
];
const OPEN_TASK_STATUSES: TaskStatus[] = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW];

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Executive KPIs ──────────────────────────────────────────────
export async function getDashboardKpis() {
  const todayStart = startOfToday();
  const in7 = new Date(Date.now() + 7 * 86400000);
  const now = new Date();

  const [
    totalEmployees,
    activeEmployees,
    activeProjects,
    completedProjects,
    delayedProjects,
    tasksCompletedToday,
    overdueTasks,
    upcomingDeadlines,
  ] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where: { status: EmployeeStatus.ACTIVE } }),
    prisma.project.count({ where: { status: { in: ACTIVE_PROJECT_STATUSES } } }),
    prisma.project.count({ where: { status: ProjectStatus.COMPLETED } }),
    prisma.project.count({
      where: { status: { in: ACTIVE_PROJECT_STATUSES }, deadline: { lt: now } },
    }),
    prisma.task.count({ where: { status: TaskStatus.DONE, completedAt: { gte: todayStart } } }),
    prisma.task.count({ where: { status: { in: OPEN_TASK_STATUSES }, dueDate: { lt: now } } }),
    prisma.task.count({
      where: { status: { in: OPEN_TASK_STATUSES }, dueDate: { gte: now, lte: in7 } },
    }),
  ]);

  const workload = await getEmployeeWorkload();
  const unassignedEmployees = workload.filter((w) => w.activeProjects === 0 && w.status === EmployeeStatus.ACTIVE).length;
  const multiProjectEmployees = workload.filter((w) => w.activeProjects > 1).length;

  return {
    totalEmployees,
    activeEmployees,
    activeProjects,
    completedProjects,
    delayedProjects,
    unassignedEmployees,
    multiProjectEmployees,
    tasksCompletedToday,
    overdueTasks,
    upcomingDeadlines,
  };
}

// ── Per-employee workload ───────────────────────────────────────
export type EmployeeWorkload = {
  id: string;
  name: string;
  designation: string;
  status: EmployeeStatus;
  avatarUrl: string | null;
  activeProjects: number;
  openTasks: number;
  overdueTasks: number;
  estimatedHours: number;
  capacity: number;
  utilizationPct: number;
  overloaded: boolean;
};

// cache(): dedupes calls within a single request render, so the dashboard's
// KPI/utilization/risk calculations share one DB fetch instead of 3–4.
export const getEmployeeWorkload = cache(async function getEmployeeWorkload(): Promise<EmployeeWorkload[]> {
  const now = new Date();
  const employees = await prisma.employee.findMany({
    include: {
      projectMemberships: { include: { project: { select: { status: true } } } },
      tasks: { select: { status: true, dueDate: true, estimatedHours: true } },
    },
    orderBy: { name: "asc" },
  });

  return employees.map((e) => {
    const activeProjects = e.projectMemberships.filter((m) =>
      ACTIVE_PROJECT_STATUSES.includes(m.project.status)
    ).length;
    const openTasks = e.tasks.filter((t) => OPEN_TASK_STATUSES.includes(t.status));
    const overdueTasks = openTasks.filter((t) => t.dueDate && t.dueDate < now).length;
    const estimatedHours = openTasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0);
    const capacity = e.weeklyCapacityHours || 40;
    const utilizationPct = Math.round((estimatedHours / capacity) * 100);

    return {
      id: e.id,
      name: e.name,
      designation: e.designation,
      status: e.status,
      avatarUrl: e.avatarUrl,
      activeProjects,
      openTasks: openTasks.length,
      overdueTasks,
      estimatedHours,
      capacity,
      utilizationPct,
      overloaded: openTasks.length > WORKLOAD_THRESHOLD || utilizationPct > 100,
    };
  });
});

// ── Project health score (0–100) ────────────────────────────────
export type ProjectHealth = {
  id: string;
  name: string;
  status: ProjectStatus;
  deadline: Date | null;
  completionRate: number;
  overdueTasks: number;
  memberCount: number;
  healthScore: number;
  risk: "low" | "medium" | "high";
};

export const getProjectHealth = cache(async function getProjectHealth(): Promise<ProjectHealth[]> {
  const now = new Date();
  const projects = await prisma.project.findMany({
    include: {
      tasks: { select: { status: true, dueDate: true } },
      _count: { select: { members: true } },
    },
    orderBy: { deadline: "asc" },
  });

  return projects.map((p) => {
    const total = p.tasks.length || 1;
    const done = p.tasks.filter((t) => t.status === TaskStatus.DONE).length;
    const completionRate = Math.round((done / total) * 100);
    const overdueTasks = p.tasks.filter(
      (t) => t.status !== TaskStatus.DONE && t.dueDate && t.dueDate < now
    ).length;

    // Weighted score: completion (50%), overdue penalty (30%), staffing (20%).
    let score = completionRate * 0.5;
    const overdueRatio = overdueTasks / total;
    score += (1 - Math.min(overdueRatio, 1)) * 30;
    score += (p._count.members > 0 ? 1 : 0) * 20;

    // Deadline pressure penalty if past or imminent and not complete.
    if (p.status !== ProjectStatus.COMPLETED && p.deadline) {
      const daysLeft = (p.deadline.getTime() - now.getTime()) / 86400000;
      if (daysLeft < 0) score -= 25;
      else if (daysLeft < 3) score -= 10;
    }
    if (p.status === ProjectStatus.COMPLETED) score = 100;

    const healthScore = Math.max(0, Math.min(100, Math.round(score)));
    const risk: ProjectHealth["risk"] = healthScore >= 70 ? "low" : healthScore >= 45 ? "medium" : "high";

    return {
      id: p.id,
      name: p.name,
      status: p.status,
      deadline: p.deadline,
      completionRate,
      overdueTasks,
      memberCount: p._count.members,
      healthScore,
      risk,
    };
  });
});

// ── Team utilization (overall capacity used) ────────────────────
export async function getTeamUtilization() {
  const workload = await getEmployeeWorkload();
  const active = workload.filter((w) => w.status === EmployeeStatus.ACTIVE);
  const totalCapacity = active.reduce((s, w) => s + w.capacity, 0) || 1;
  const totalAllocated = active.reduce((s, w) => s + w.estimatedHours, 0);
  return {
    utilizationPct: Math.round((totalAllocated / totalCapacity) * 100),
    totalCapacity,
    totalAllocated,
    overloadedCount: active.filter((w) => w.overloaded).length,
  };
}

// ── Risk detection feed ─────────────────────────────────────────
export type RiskItem = {
  type: "DELAYED_PROJECT" | "OVERLOADED_EMPLOYEE" | "APPROACHING_DEADLINE" | "RESOURCE_SHORTAGE";
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  link: string;
};

export async function getRisks(): Promise<RiskItem[]> {
  const now = new Date();
  const in3 = new Date(Date.now() + 3 * 86400000);
  const risks: RiskItem[] = [];

  const health = await getProjectHealth();
  for (const p of health) {
    if (p.status !== ProjectStatus.COMPLETED && p.deadline && p.deadline < now) {
      risks.push({ type: "DELAYED_PROJECT", severity: "high", title: `${p.name} is overdue`, detail: `${p.overdueTasks} overdue task(s), health ${p.healthScore}/100.`, link: `/projects/${p.id}` });
    } else if (p.status !== ProjectStatus.COMPLETED && p.deadline && p.deadline <= in3) {
      risks.push({ type: "APPROACHING_DEADLINE", severity: "medium", title: `${p.name} due soon`, detail: `Deadline ${p.deadline.toLocaleDateString()}, ${p.completionRate}% complete.`, link: `/projects/${p.id}` });
    }
    if (p.status !== ProjectStatus.COMPLETED && p.memberCount === 0) {
      risks.push({ type: "RESOURCE_SHORTAGE", severity: "medium", title: `${p.name} has no assigned team`, detail: "Assign members to begin work.", link: `/projects/${p.id}` });
    }
  }

  const workload = await getEmployeeWorkload();
  for (const w of workload.filter((w) => w.overloaded)) {
    risks.push({ type: "OVERLOADED_EMPLOYEE", severity: "high", title: `${w.name} is overloaded`, detail: `${w.openTasks} open tasks across ${w.activeProjects} projects (${w.utilizationPct}% capacity).`, link: `/employees/${w.id}` });
  }

  const order = { high: 0, medium: 1, low: 2 };
  return risks.sort((a, b) => order[a.severity] - order[b.severity]);
}

// ── Chart datasets ──────────────────────────────────────────────
export async function getDashboardCharts() {
  // Task completion trend (last 14 days)
  const since = new Date();
  since.setDate(since.getDate() - 13);
  since.setHours(0, 0, 0, 0);

  const doneTasks = await prisma.task.findMany({
    where: { completedAt: { gte: since } },
    select: { completedAt: true },
  });

  const trend: { date: string; completed: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const day = new Date(since);
    day.setDate(since.getDate() + i);
    const key = day.toISOString().slice(0, 10);
    const completed = doneTasks.filter((t) => t.completedAt && t.completedAt.toISOString().slice(0, 10) === key).length;
    trend.push({ date: key.slice(5), completed });
  }

  // Project status distribution
  const grouped = await prisma.project.groupBy({ by: ["status"], _count: true });
  const statusDistribution = grouped.map((g) => ({ status: g.status, count: g._count }));

  // Department performance (completed vs open tasks)
  const depts = await prisma.department.findMany({
    include: {
      employees: { include: { tasks: { select: { status: true } } } },
    },
  });
  const departmentPerformance = depts.map((d) => {
    const tasks = d.employees.flatMap((e) => e.tasks);
    const done = tasks.filter((t) => t.status === TaskStatus.DONE).length;
    const open = tasks.length - done;
    return { department: d.name, done, open };
  });

  const workload = await getEmployeeWorkload();
  const workloadChart = workload
    .filter((w) => w.status === EmployeeStatus.ACTIVE)
    .map((w) => ({ name: w.name.split(" ")[0], tasks: w.openTasks, utilization: w.utilizationPct }));

  return { trend, statusDistribution, departmentPerformance, workloadChart };
}
