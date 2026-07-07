import { PageHeader } from "@/components/page-header";
import { AccountClient } from "./account-client";
import { AvatarUpload } from "./avatar-upload";
import { requireUser } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";

export default async function AccountPage() {
  const user = await requireUser();
  // Read the current avatar fresh from the employee profile (session may be stale).
  const employee = user.employeeId
    ? await prisma.employee.findUnique({ where: { id: user.employeeId }, select: { avatarUrl: true } })
    : null;

  return (
    <div>
      <PageHeader title="My Account" subtitle="Your profile and security settings." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <AvatarUpload name={user.name ?? "User"} initialSrc={employee?.avatarUrl ?? null} />
            <div>
              <p className="font-medium">{user.name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <p className="mt-1 text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</p>
            </div>
          </CardContent>
        </Card>
        <AccountClient />
      </div>
    </div>
  );
}
