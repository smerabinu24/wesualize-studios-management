import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Avatar is read from the DB here (not the session cookie) so large photo
  // data never bloats the auth cookie.
  const employee = user.employeeId
    ? await prisma.employee.findUnique({ where: { id: user.employeeId }, select: { avatarUrl: true } })
    : null;

  return <AppShell user={{ ...user, avatarUrl: employee?.avatarUrl ?? null }}>{children}</AppShell>;
}
