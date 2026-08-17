/**
 * Leave engine.
 *
 * Policy, as configured:
 *   • Every employee accrues MONTHLY_LEAVE_ALLOWANCE paid days each calendar
 *     month, starting the month they joined.
 *   • Unused days are never lost — the balance is simply (accrued − used), so
 *     anything untaken carries forward indefinitely, month after month.
 *   • One weekly day off, per employee, defaulting to Sunday. It is a
 *     non-working day, so it never consumes the monthly allowance. Moving
 *     someone's off day to (say) Wednesday means they work Sundays instead.
 *   • Once the balance reaches zero, further days are recorded as UNPAID
 *     rather than silently pushing the balance negative.
 */
import { prisma } from "@/lib/prisma";
import { LeaveKind, LeaveStatus, LeaveType } from "@prisma/client";

/**
 * A request holds its day as soon as it is made, and keeps holding it once
 * approved — only a rejection gives the day back. This stops someone
 * requesting twenty days and still appearing to have a full balance.
 */
const HOLDS_BALANCE: LeaveStatus[] = [LeaveStatus.PENDING, LeaveStatus.APPROVED];

/** Paid leave days credited per calendar month. */
export const MONTHLY_LEAVE_ALLOWANCE = Number(process.env.MONTHLY_LEAVE_ALLOWANCE ?? 2);

export const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const;

/** Strip the time part so a date identifies exactly one calendar day. */
export function startOfDay(d: Date | string) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Whole calendar months from `from` up to and including the current month. */
function monthsInclusive(from: Date, to: Date) {
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;
  return Math.max(0, months);
}

export type LeaveBalance = {
  weeklyOffDay: number;
  weeklyOffName: string;
  joinedAt: Date;
  /** Calendar months accrued so far, counting the joining month. */
  monthsAccrued: number;
  /** monthsAccrued × MONTHLY_LEAVE_ALLOWANCE. */
  credited: number;
  /** PAID days held across all time — approved plus still-pending. */
  used: number;
  /** Days still available, including everything carried over. */
  balance: number;
  /** Balance as it stood at the start of the current month. */
  carriedOver: number;
  usedThisMonth: number;
  /** Days recorded once the allowance ran out. */
  unpaidCount: number;
  /** Requests awaiting an administrator's decision. */
  pendingCount: number;
  /** Requests that were declined — these do not consume any balance. */
  rejectedCount: number;
  /** Approved work-from-home days, all time. */
  wfhApproved: number;
  /** Work-from-home days this month (approved or awaiting a decision). */
  wfhThisMonth: number;
};

/** Is this date the employee's weekly off (and therefore not a working day)? */
export function isWeeklyOff(date: Date, weeklyOffDay: number) {
  return startOfDay(date).getDay() === weeklyOffDay;
}

export async function getLeaveBalance(employeeId: string): Promise<LeaveBalance | null> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { joiningDate: true, weeklyOffDay: true },
  });
  if (!employee) return null;

  const all = await prisma.leave.findMany({
    where: { employeeId },
    select: { date: true, type: true, status: true, kind: true },
  });
  // Working from home costs no allowance — the person is still working.
  const leaves = all.filter((l) => l.kind === LeaveKind.LEAVE);
  const wfh = all.filter((l) => l.kind === LeaveKind.WORK_FROM_HOME);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthsAccrued = monthsInclusive(employee.joiningDate, now);
  const credited = monthsAccrued * MONTHLY_LEAVE_ALLOWANCE;

  // Rejected days are released — they cost the employee nothing.
  const held = leaves.filter((l) => HOLDS_BALANCE.includes(l.status));
  const paid = held.filter((l) => l.type === LeaveType.PAID);
  const used = paid.length;
  const usedThisMonth = paid.filter((l) => l.date >= monthStart).length;
  const usedBeforeThisMonth = used - usedThisMonth;

  // What was left when this month began: everything accrued up to last month
  // minus everything spent before this month. Never shown as negative.
  const creditedBeforeThisMonth = Math.max(0, monthsAccrued - 1) * MONTHLY_LEAVE_ALLOWANCE;
  const carriedOver = Math.max(0, creditedBeforeThisMonth - usedBeforeThisMonth);

  return {
    weeklyOffDay: employee.weeklyOffDay,
    weeklyOffName: WEEKDAY_NAMES[employee.weeklyOffDay] ?? "Sunday",
    joinedAt: employee.joiningDate,
    monthsAccrued,
    credited,
    used,
    balance: credited - used,
    carriedOver,
    usedThisMonth,
    unpaidCount: held.length - used,
    pendingCount: all.filter((l) => l.status === LeaveStatus.PENDING).length,
    rejectedCount: all.filter((l) => l.status === LeaveStatus.REJECTED).length,
    wfhApproved: wfh.filter((l) => l.status === LeaveStatus.APPROVED).length,
    wfhThisMonth: wfh.filter((l) => HOLDS_BALANCE.includes(l.status) && l.date >= monthStart).length,
  };
}

/**
 * Record a day off.
 * Refuses the employee's weekly off (already a non-working day) and refuses
 * duplicates. Falls back to UNPAID once the accrued balance is exhausted.
 */
export async function markLeave(opts: {
  employeeId: string;
  date: string | Date;
  reason?: string;
  createdById?: string;
  /** Day off (default) or working from home. */
  kind?: LeaveKind;
  /** Set when an administrator records the leave — it needs no further approval. */
  autoApprove?: boolean;
}) {
  const date = startOfDay(opts.date);
  const balance = await getLeaveBalance(opts.employeeId);
  if (!balance) {
    const err = new Error("Employee not found") as Error & { status?: number };
    err.status = 404;
    throw err;
  }

  if (isWeeklyOff(date, balance.weeklyOffDay)) {
    const err = new Error(
      `${WEEKDAY_NAMES[date.getDay()]} is already your weekly day off, so it does not need to be booked.`
    ) as Error & { status?: number };
    err.status = 400;
    throw err;
  }

  const existing = await prisma.leave.findUnique({
    where: { employeeId_date: { employeeId: opts.employeeId, date } },
  });
  if (existing) {
    // A previously rejected day is free again — replace it rather than
    // blocking the employee from ever re-requesting that date.
    if (existing.status === LeaveStatus.REJECTED) {
      await prisma.leave.delete({ where: { id: existing.id } });
    } else {
      const err = new Error(
        existing.status === LeaveStatus.PENDING
          ? "You already have a request awaiting approval for that day."
          : "Leave is already approved for that day."
      ) as Error & { status?: number };
      err.status = 409;
      throw err;
    }
  }

  return prisma.leave.create({
    data: {
      employeeId: opts.employeeId,
      date,
      kind: opts.kind ?? LeaveKind.LEAVE,
      // Only a day off can be unpaid. Working from home is always paid work,
      // however little allowance is left.
      type:
        (opts.kind ?? LeaveKind.LEAVE) === LeaveKind.WORK_FROM_HOME || balance.balance > 0
          ? LeaveType.PAID
          : LeaveType.UNPAID,
      reason: opts.reason,
      createdById: opts.createdById,
      // An administrator booking leave IS the approval — no point making
      // them approve their own entry afterwards.
      ...(opts.autoApprove
        ? { status: LeaveStatus.APPROVED, decidedById: opts.createdById, decidedAt: new Date() }
        : {}),
    },
  });
}

/** Approve or reject a pending request, and tell the employee. */
export async function decideLeave(opts: {
  id: string;
  approve: boolean;
  decidedById: string;
  note?: string;
}) {
  const leave = await prisma.leave.findUnique({
    where: { id: opts.id },
    include: { employee: { select: { userId: true } } },
  });
  if (!leave) {
    const err = new Error("Leave not found") as Error & { status?: number };
    err.status = 404;
    throw err;
  }

  const updated = await prisma.leave.update({
    where: { id: opts.id },
    data: {
      status: opts.approve ? LeaveStatus.APPROVED : LeaveStatus.REJECTED,
      decidedById: opts.decidedById,
      decidedAt: new Date(),
      decisionNote: opts.note,
    },
  });

  if (leave.employee?.userId) {
    const day = leave.date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
    await prisma.notification.create({
      data: {
        userId: leave.employee.userId,
        type: "SYSTEM",
        title: `Leave ${opts.approve ? "approved" : "rejected"} — ${day}`,
        link: "/leave",
      },
    });
  }
  return updated;
}

/** Requests awaiting a decision, oldest first so nothing sits forgotten. */
export function getPendingLeaves() {
  return prisma.leave.findMany({
    where: { status: LeaveStatus.PENDING },
    orderBy: { date: "asc" },
    include: { employee: { select: { id: true, name: true, avatarUrl: true } } },
  });
}

/** Remove a recorded leave, returning the day to the balance if it was paid. */
export async function deleteLeave(id: string, opts: { employeeId?: string } = {}) {
  const leave = await prisma.leave.findUnique({ where: { id } });
  if (!leave || (opts.employeeId && leave.employeeId !== opts.employeeId)) {
    const err = new Error("Leave not found") as Error & { status?: number };
    err.status = 404;
    throw err;
  }
  return prisma.leave.delete({ where: { id } });
}

/** An employee's recorded leave, newest first. */
export function getLeaves(employeeId: string, take = 100) {
  return prisma.leave.findMany({
    where: { employeeId },
    orderBy: { date: "desc" },
    take,
  });
}

/** Balances for the whole team — one pass, for the manager view. */
export async function getTeamLeave() {
  const employees = await prisma.employee.findMany({
    select: { id: true, name: true, avatarUrl: true, joiningDate: true, weeklyOffDay: true },
    orderBy: { name: "asc" },
  });
  const all = await prisma.leave.findMany({ select: { employeeId: true, date: true, type: true, status: true, kind: true } });
  const held = all.filter((l) => HOLDS_BALANCE.includes(l.status));
  const leaves = held.filter((l) => l.kind === LeaveKind.LEAVE);
  const wfh = held.filter((l) => l.kind === LeaveKind.WORK_FROM_HOME);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return employees.map((e) => {
    const mine = leaves.filter((l) => l.employeeId === e.id);
    const paid = mine.filter((l) => l.type === LeaveType.PAID);
    const monthsAccrued = monthsInclusive(e.joiningDate, now);
    const credited = monthsAccrued * MONTHLY_LEAVE_ALLOWANCE;

    return {
      id: e.id,
      name: e.name,
      avatarUrl: e.avatarUrl,
      weeklyOffName: WEEKDAY_NAMES[e.weeklyOffDay] ?? "Sunday",
      credited,
      used: paid.length,
      balance: credited - paid.length,
      usedThisMonth: paid.filter((l) => l.date >= monthStart).length,
      unpaidCount: mine.length - paid.length,
      pendingCount: all.filter((l) => l.employeeId === e.id && l.status === "PENDING").length,
      wfhThisMonth: wfh.filter((l) => l.employeeId === e.id && l.date >= monthStart).length,
    };
  });
}
