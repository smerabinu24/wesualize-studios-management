import { CalendarDays, Info } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { LeaveClient } from "./leave-client";
import { requireUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import {
  getLeaveBalance, getLeaves, getTeamLeave, getPendingLeaves, MONTHLY_LEAVE_ALLOWANCE,
} from "@/lib/leave";
import { ApprovalsClient } from "./approvals-client";
import { Card, CardContent, CardHeader, CardTitle, Badge, Avatar, EmptyState } from "@/components/ui/primitives";
import { Table, Thead, Th, Td, Tr } from "@/components/ui/table";

export default async function LeavePage() {
  const user = await requireUser();
  const showTeam = can(user.role, "leave:view-team");

  if (!user.employeeId) {
    return (
      <div>
        <PageHeader title="Leave" />
        <EmptyState icon={CalendarDays} title="No employee profile"
          description="This account isn't linked to an employee profile, so leave tracking is unavailable." />
      </div>
    );
  }

  const canApprove = can(user.role, "leave:approve");
  const [balance, leaves, team, pending] = await Promise.all([
    getLeaveBalance(user.employeeId),
    getLeaves(user.employeeId),
    showTeam ? getTeamLeave() : Promise.resolve([]),
    canApprove ? getPendingLeaves() : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader title="Leave" subtitle="Your leave balance, history and the studio's leave policy." />

      {/* The policy, stated plainly — everyone can read the rules they're held to. */}
      <Card className="mb-6 border-primary/30 bg-primary/5">
        <CardHeader className="flex-row items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          <CardTitle>Leave policy</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>
              • You get <strong className="text-foreground">{MONTHLY_LEAVE_ALLOWANCE} paid leaves every month</strong>,
              credited from the month you joined.
            </li>
            <li>
              • <strong className="text-foreground">Unused leaves carry over</strong> to the next month and keep
              accumulating — they never expire.
            </li>
            <li>
              • You have <strong className="text-foreground">one weekly day off</strong>, currently{" "}
              <strong className="text-foreground">{balance?.weeklyOffName ?? "Sunday"}</strong>. It does not count
              against your monthly leaves. If your off day is moved, you work that former day instead.
            </li>
            <li>
              • Once your balance reaches zero, further days are still recorded but marked{" "}
              <strong className="text-foreground">unpaid</strong>.
            </li>
            <li>
              • Every request needs{" "}
              <strong className="text-foreground">administrator approval</strong>. A pending request already holds
              the day against your balance; if it is rejected, the day is returned to you.
            </li>
          </ul>
        </CardContent>
      </Card>

      {canApprove && (
        <ApprovalsClient
          pending={pending.map((p) => ({
            id: p.id,
            employeeName: p.employee?.name ?? "Unknown",
            avatarUrl: p.employee?.avatarUrl ?? null,
            date: p.date.toISOString(),
            type: p.type,
            reason: p.reason,
          }))}
        />
      )}

      {balance && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Available now</p>
            <p className={`tabular text-2xl font-bold ${balance.balance > 0 ? "text-success" : "text-destructive"}`}>
              {balance.balance}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">including carry-over</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Carried over</p>
            <p className="tabular text-2xl font-bold">{balance.carriedOver}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">from previous months</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Used this month</p>
            <p className="tabular text-2xl font-bold">{balance.usedThisMonth}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">of {MONTHLY_LEAVE_ALLOWANCE} credited</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total earned</p>
            <p className="tabular text-2xl font-bold">{balance.credited}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{balance.used} taken so far</p>
          </Card>
        </div>
      )}

      <LeaveClient
        initialLeaves={leaves.map((l) => ({
          id: l.id,
          date: l.date.toISOString(),
          type: l.type,
          reason: l.reason,
          status: l.status,
          decisionNote: l.decisionNote,
        }))}
        balance={balance?.balance ?? 0}
        weeklyOffDay={balance?.weeklyOffDay ?? 0}
      />

      {showTeam && team.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <CalendarDays className="h-4 w-4" /> Team leave balances
          </h3>
          <Table>
            <Thead>
              <tr>
                <Th>Employee</Th><Th>Weekly off</Th>
                <Th className="text-right">This month</Th>
                <Th className="text-right">Taken</Th>
                <Th className="text-right">Available</Th>
              </tr>
            </Thead>
            <tbody>
              {team.map((e) => (
                <Tr key={e.id}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <Avatar name={e.name} src={e.avatarUrl} size={22} />
                      <span className="text-sm font-medium">{e.name}</span>
                    </div>
                  </Td>
                  <Td className="text-sm text-muted-foreground">{e.weeklyOffName}</Td>
                  <Td className="tabular text-right text-sm">{e.usedThisMonth}</Td>
                  <Td className="tabular text-right text-sm">
                    {e.used}
                    {e.unpaidCount > 0 && <span className="text-warning"> +{e.unpaidCount} unpaid</span>}
                    {e.pendingCount > 0 && <span className="text-muted-foreground"> ({e.pendingCount} pending)</span>}
                  </Td>
                  <Td className="text-right">
                    <Badge tone={e.balance > 0 ? "success" : "destructive"}>{e.balance}</Badge>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
