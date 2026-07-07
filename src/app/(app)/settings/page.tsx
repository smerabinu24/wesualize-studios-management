import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/primitives";
import { Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { requireCan } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { WORKLOAD_THRESHOLD } from "@/lib/bi";

export default async function SettingsPage() {
  await requireCan("settings:manage");
  const [departments, recentLogs] = await Promise.all([
    prisma.department.findMany({ include: { _count: { select: { employees: true } } }, orderBy: { name: "asc" } }),
    prisma.activityLog.findMany({
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  return (
    <div>
      <PageHeader title="Settings" subtitle="System configuration, departments and audit log." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Business Rules</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Overload threshold</span><span className="tabular font-medium">{WORKLOAD_THRESHOLD} active tasks</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Session length</span><span className="font-medium">8 hours</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Default capacity</span><span className="tabular font-medium">40 h/week</span></div>
            <p className="pt-2 text-xs text-muted-foreground">Configure via <code className="tabular">WORKLOAD_THRESHOLD</code> in environment.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Departments</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {departments.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-sm">
                <span>{d.name}</span>
                <Badge tone="muted">{d._count.employees}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Roles</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p><span className="font-medium text-foreground">Administrator</span> — full access to all modules, analytics and settings.</p>
            <p><span className="font-medium text-foreground">Team Lead</span> — manage assigned projects, assign tasks, view team analytics.</p>
            <p><span className="font-medium text-foreground">Employee</span> — view and update assigned tasks only.</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <h3 className="mb-3 text-lg font-semibold">Audit Log</h3>
        <Table>
          <Thead><tr><Th>When</Th><Th>User</Th><Th>Action</Th><Th>Entity</Th></tr></Thead>
          <tbody>
            {recentLogs.map((l) => (
              <Tr key={l.id}>
                <Td className="tabular text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</Td>
                <Td className="text-sm">{l.user?.email ?? "system"}</Td>
                <Td><Badge tone="primary">{l.action}</Badge></Td>
                <Td className="text-sm text-muted-foreground">{l.entityType ?? "—"}</Td>
              </Tr>
            ))}
            {recentLogs.length === 0 && <Tr><Td colSpan={4} className="py-8 text-center text-muted-foreground">No activity yet.</Td></Tr>}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
