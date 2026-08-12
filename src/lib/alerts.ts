/**
 * Sidebar badge counts and the notification bell.
 *
 * A badge is a promise that something needs doing, so every count here must be
 * clearable by the person seeing it. Anything permanently red becomes wallpaper
 * and stops being read — so no "total tasks" or similar vanity counters.
 */
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { LeaveStatus, Role, TaskStatus } from "@prisma/client";

const OPEN_TASKS = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.REVIEW];

export type NavBadges = Record<string, number>;

/**
 * Per-route counts keyed by nav href.
 *  • /leave  — requests you must decide (admins), or your own still awaiting one.
 *  • /tasks  — your overdue work; studio-wide for those who see every task.
 */
export async function getNavBadges(user: {
  role: Role;
  employeeId?: string | null;
}): Promise<NavBadges> {
  const badges: NavBadges = {};
  const me = user.employeeId ?? "__none__";
  const isEmployee = user.role === Role.EMPLOYEE;

  const [pendingToDecide, myPendingLeave, overdue] = await Promise.all([
    can(user.role, "leave:approve")
      ? prisma.leave.count({ where: { status: LeaveStatus.PENDING } })
      : Promise.resolve(0),
    user.employeeId
      ? prisma.leave.count({ where: { employeeId: me, status: LeaveStatus.PENDING } })
      : Promise.resolve(0),
    prisma.task.count({
      where: {
        status: { in: OPEN_TASKS },
        dueDate: { lt: new Date() },
        archivedAt: null,
        // Employees only ever see their own work, so only count theirs.
        ...(isEmployee
          ? { OR: [{ assigneeId: me }, { collaborators: { some: { employeeId: me } } }] }
          : {}),
      },
    }),
  ]);

  // Approvals outrank your own pending request — one is an action, the other a wait.
  const leaveCount = pendingToDecide || myPendingLeave;
  if (leaveCount > 0) badges["/leave"] = leaveCount;
  if (overdue > 0) badges["/tasks"] = overdue;

  return badges;
}

/** Unread notification count for the bell. */
export function getUnreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

/** Most recent notifications, unread first. */
export async function getNotifications(userId: string, take = 12) {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
    take,
  });
  return rows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    link: n.link,
    read: n.readAt != null,
    createdAt: n.createdAt.toISOString(),
  }));
}

export function markAllRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
