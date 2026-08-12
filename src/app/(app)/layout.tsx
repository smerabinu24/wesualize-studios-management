import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getNavBadges, getNotifications, getUnreadCount } from "@/lib/alerts";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // Avatar is read from the DB here (not the session cookie) so large photo
  // data never bloats the auth cookie.
  const [employee, badges, notifications, unread] = await Promise.all([
    user.employeeId
      ? prisma.employee.findUnique({ where: { id: user.employeeId }, select: { avatarUrl: true } })
      : Promise.resolve(null),
    getNavBadges(user),
    getNotifications(user.id),
    getUnreadCount(user.id),
  ]);

  return (
    <AppShell
      user={{ ...user, avatarUrl: employee?.avatarUrl ?? null }}
      badges={badges}
      notifications={notifications}
      unread={unread}
    >
      {children}
    </AppShell>
  );
}
