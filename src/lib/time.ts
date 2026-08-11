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

/**
 * Manually log time against a task for a chosen day (end-of-day entry).
 * Either `taskId` (existing) OR `newTaskTitle`+`projectId` (create task inline).
 * Creates a completed TimeEntry and rolls the hours into Task.actualHours.
 */
export async function logManualTaskTime(
  employeeId: string,
  opts: { taskId?: string; newTaskTitle?: string; projectId?: string; date: string; hours: number; note?: string }
) {
  if (!(opts.hours > 0) || opts.hours > 24) {
    const err = new Error("Hours must be between 0 and 24.") as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  let taskId = opts.taskId;
  let projectId: string | null = opts.projectId ?? null;

  if (!taskId) {
    if (!opts.newTaskTitle || !opts.projectId) {
      const err = new Error("Select a task, or give a new task title and project.") as Error & { status?: number };
      err.status = 400;
      throw err;
    }
    const created = await prisma.task.create({
      data: { title: opts.newTaskTitle, projectId: opts.projectId, assigneeId: employeeId, status: "TODO" },
    });
    taskId = created.id;
    projectId = opts.projectId;
  } else {
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true } });
    if (!task) {
      const err = new Error("Task not found") as Error & { status?: number };
      err.status = 404;
      throw err;
    }
    projectId = task.projectId;
  }

  const startedAt = new Date(`${opts.date}T09:00:00`);
  const endedAt = new Date(startedAt.getTime() + opts.hours * 3_600_000);
  const rounded = Math.round(opts.hours * 100) / 100;

  return prisma.$transaction(async (tx) => {
    const entry = await tx.timeEntry.create({
      data: { employeeId, kind: TimeEntryKind.TASK, taskId, projectId, startedAt, endedAt, note: opts.note },
    });
    await tx.task.update({ where: { id: taskId! }, data: { actualHours: { increment: rounded } } });
    return entry;
  });
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

/**
 * Every logged entry across the team for a range, newest first — powers the
 * manager-facing log view so nobody has to export a PDF just to read it.
 */
export async function getAllEntries(range: TimeRange = "week", take = 300) {
  const start = rangeStart(range);
  const entries = await prisma.timeEntry.findMany({
    where: { kind: TimeEntryKind.TASK, endedAt: { not: null }, startedAt: { gte: start } },
    orderBy: { startedAt: "desc" },
    take,
    include: {
      employee: { select: { id: true, name: true, avatarUrl: true } },
      task: { select: { title: true } },
      project: { select: { name: true } },
    },
  });

  return entries.map((e) => ({
    id: e.id,
    employeeName: e.employee?.name ?? "Unknown",
    avatarUrl: e.employee?.avatarUrl ?? null,
    task: e.task?.title ?? "Task",
    project: e.project?.name ?? "",
    note: e.note,
    startedAt: e.startedAt,
    hours: hoursBetween(e.startedAt, e.endedAt!),
  }));
}

/** Local (not UTC) YYYY-MM-DD key, so a day maps to the studio's calendar day. */
function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type Contributions = {
  /** Hours logged per YYYY-MM-DD. Days with no work are absent. */
  days: Record<string, number>;
  totalHours: number;
  activeDays: number;
  /** Consecutive active days ending today (or yesterday, so it survives the morning). */
  currentStreak: number;
  longestStreak: number;
  bestDay: { date: string; hours: number } | null;
};

/**
 * GitHub-style yearly activity, built from logged task time.
 * Returns one entry per employee id so the team view costs a single query
 * rather than one per person.
 */
export async function getContributions(opts: { employeeId?: string; days?: number } = {}) {
  const span = opts.days ?? 371; // 53 whole weeks
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - span + 1);

  const entries = await prisma.timeEntry.findMany({
    where: {
      kind: TimeEntryKind.TASK,
      endedAt: { not: null },
      startedAt: { gte: since },
      ...(opts.employeeId ? { employeeId: opts.employeeId } : {}),
    },
    select: { employeeId: true, startedAt: true, endedAt: true },
  });

  const perEmployee = new Map<string, Record<string, number>>();
  for (const e of entries) {
    const map = perEmployee.get(e.employeeId) ?? {};
    const k = dayKey(e.startedAt);
    map[k] = (map[k] ?? 0) + hoursBetween(e.startedAt, e.endedAt!);
    perEmployee.set(e.employeeId, map);
  }

  const result = new Map<string, Contributions>();
  for (const [employeeId, days] of perEmployee) {
    // Round once at the end so many short entries don't drift.
    for (const k of Object.keys(days)) days[k] = Math.round(days[k] * 100) / 100;

    const dates = Object.keys(days).sort();
    let longest = 0;
    let run = 0;
    let prev: Date | null = null;
    for (const d of dates) {
      const cur = new Date(`${d}T00:00:00`);
      run = prev && (cur.getTime() - prev.getTime()) / 86_400_000 === 1 ? run + 1 : 1;
      longest = Math.max(longest, run);
      prev = cur;
    }

    // Current streak: walk back from today, tolerating "hasn't logged yet today".
    let current = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    if (!days[dayKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
    while (days[dayKey(cursor)]) {
      current += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    const best = dates.reduce<{ date: string; hours: number } | null>(
      (acc, d) => (acc == null || days[d] > acc.hours ? { date: d, hours: days[d] } : acc),
      null
    );

    result.set(employeeId, {
      days,
      totalHours: Math.round(dates.reduce((s, d) => s + days[d], 0) * 100) / 100,
      activeDays: dates.length,
      currentStreak: current,
      longestStreak: longest,
      bestDay: best,
    });
  }

  return result;
}

/** Delete one of the employee's own time entries; reverse its task-hour roll-in. */
export async function deleteEntry(employeeId: string, entryId: string) {
  const entry = await prisma.timeEntry.findUnique({ where: { id: entryId } });
  if (!entry || entry.employeeId !== employeeId) {
    const err = new Error("Entry not found") as Error & { status?: number };
    err.status = 404;
    throw err;
  }
  return prisma.$transaction(async (tx) => {
    if (entry.kind === TimeEntryKind.TASK && entry.taskId && entry.endedAt) {
      const hours = Math.round(hoursBetween(entry.startedAt, entry.endedAt) * 100) / 100;
      await tx.task.update({ where: { id: entry.taskId }, data: { actualHours: { decrement: hours } } }).catch(() => {});
    }
    await tx.timeEntry.delete({ where: { id: entryId } });
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
