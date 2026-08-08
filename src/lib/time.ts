/**
 * Time tracking engine — attendance (clock in/out) + per-task project time.
 * A user has at most ONE running ATTENDANCE entry and ONE running TASK entry.
 */
import { prisma } from "@/lib/prisma";
import { TimeEntryKind } from "@prisma/client";

export function hoursBetween(start: Date, end: Date) {
  return (end.getTime() - start.getTime()) / 3_600_000;
}

function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfToday() {
  const x = new Date();
  x.setHours(0, 0, 0, 0);
  return x;
}

/** The user's currently-running entries (attendance + task), if any. */
export async function getActiveEntries(employeeId: string) {
  const [attendance, task] = await Promise.all([
    prisma.timeEntry.findFirst({
      where: { employeeId, kind: TimeEntryKind.ATTENDANCE, endedAt: null },
      orderBy: { startedAt: "desc" },
    }),
    prisma.timeEntry.findFirst({
      where: { employeeId, kind: TimeEntryKind.TASK, endedAt: null },
      orderBy: { startedAt: "desc" },
      include: { task: { select: { id: true, title: true } }, project: { select: { name: true } } },
    }),
  ]);
  return { attendance, task };
}

/** Toggle the workday clock: start if not clocked in, otherwise clock out. */
export async function toggleClock(employeeId: string) {
  const running = await prisma.timeEntry.findFirst({
    where: { employeeId, kind: TimeEntryKind.ATTENDANCE, endedAt: null },
  });
  if (running) {
    return prisma.timeEntry.update({ where: { id: running.id }, data: { endedAt: new Date() } });
  }
  return prisma.timeEntry.create({ data: { employeeId, kind: TimeEntryKind.ATTENDANCE } });
}

/** Stop the running task timer (if any) and roll its hours into Task.actualHours. */
export async function stopRunningTask(employeeId: string) {
  const running = await prisma.timeEntry.findFirst({
    where: { employeeId, kind: TimeEntryKind.TASK, endedAt: null },
  });
  if (!running) return null;

  const endedAt = new Date();
  const hours = hoursBetween(running.startedAt, endedAt);

  await prisma.$transaction(async (tx) => {
    await tx.timeEntry.update({ where: { id: running.id }, data: { endedAt } });
    if (running.taskId) {
      await tx.task.update({
        where: { id: running.taskId },
        data: { actualHours: { increment: Math.round(hours * 100) / 100 } },
      });
    }
  });
  return running;
}

/** Start a task timer (stops any other running task first). */
export async function startTask(employeeId: string, taskId: string) {
  await stopRunningTask(employeeId); // one task timer at a time
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true } });
  if (!task) {
    const err = new Error("Task not found") as Error & { status?: number };
    err.status = 404;
    throw err;
  }
  return prisma.timeEntry.create({
    data: { employeeId, kind: TimeEntryKind.TASK, taskId, projectId: task.projectId },
  });
}

/** Today + this-week totals (hours) for an employee, split by kind. */
export async function getEmployeeTotals(employeeId: string) {
  const weekStart = startOfWeek();
  const entries = await prisma.timeEntry.findMany({
    where: { employeeId, startedAt: { gte: weekStart }, endedAt: { not: null } },
  });
  const todayStart = startOfToday();
  const sum = (list: typeof entries) =>
    list.reduce((h, e) => h + hoursBetween(e.startedAt, e.endedAt!), 0);

  const task = entries.filter((e) => e.kind === TimeEntryKind.TASK);
  const attendance = entries.filter((e) => e.kind === TimeEntryKind.ATTENDANCE);

  return {
    todayTask: sum(task.filter((e) => e.startedAt >= todayStart)),
    weekTask: sum(task),
    todayAttendance: sum(attendance.filter((e) => e.startedAt >= todayStart)),
    weekAttendance: sum(attendance),
  };
}

/** Manager view: per-employee hours with a per-task/project breakdown, for a range. */
export type TimeRange = "week" | "month" | "all";

function rangeStart(range: TimeRange) {
  if (range === "all") return new Date(0);
  const d = new Date();
  if (range === "month") {
    d.setDate(1);
  } else {
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getTeamTime(range: TimeRange = "week") {
  const start = rangeStart(range);
  const employees = await prisma.employee.findMany({
    include: {
      timeEntries: {
        where: { endedAt: { not: null }, startedAt: { gte: start } },
        include: { task: { select: { title: true } }, project: { select: { name: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return employees.map((e) => {
    let attendanceHours = 0;
    let taskHours = 0;
    const byTask = new Map<string, { label: string; project: string; hours: number }>();

    for (const t of e.timeEntries) {
      const h = hoursBetween(t.startedAt, t.endedAt!);
      if (t.kind === "ATTENDANCE") {
        attendanceHours += h;
      } else {
        taskHours += h;
        const key = t.taskId ?? "unknown";
        const cur = byTask.get(key) ?? { label: t.task?.title ?? "Task", project: t.project?.name ?? "", hours: 0 };
        cur.hours += h;
        byTask.set(key, cur);
      }
    }

    return {
      id: e.id,
      name: e.name,
      avatarUrl: e.avatarUrl,
      attendanceHours,
      taskHours,
      entryCount: e.timeEntries.length,
      byTask: [...byTask.values()].sort((a, b) => b.hours - a.hours),
    };
  });
}

/** Recent completed entries for the entries list. */
export async function getRecentEntries(employeeId: string, take = 25) {
  return prisma.timeEntry.findMany({
    where: { employeeId, endedAt: { not: null } },
    orderBy: { startedAt: "desc" },
    take,
    include: { task: { select: { title: true } }, project: { select: { name: true } } },
  });
}
