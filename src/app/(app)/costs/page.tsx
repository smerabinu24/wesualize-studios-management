import { Wallet, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireCan } from "@/lib/session";
import { getProjectCosts } from "@/lib/cost";
import { Card, CardContent, CardHeader, CardTitle, Badge, EmptyState } from "@/components/ui/primitives";
import { Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { can } from "@/lib/rbac";
import { currency } from "@/lib/utils";

export default async function CostsPage() {
  // `finance:view` — Admins and Team Leads. Individual rates need finance:manage.
  const user = await requireCan("finance:view");
  const showRates = can(user.role, "finance:manage");
  const costs = await getProjectCosts();

  const totalCost = costs.reduce((s, p) => s + p.cost, 0);
  const totalHours = costs.reduce((s, p) => s + p.hours, 0);
  const anyUnrated = costs.some((p) => p.unratedNames.length > 0);

  return (
    <div>
      <PageHeader
        title="Project Costs"
        subtitle="Labour cost per project, from logged hours × each person's hourly rate."
      />

      {costs.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nothing to cost yet"
          description="Once employees log time and have an hourly rate set on their profile, project costs appear here."
        />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Total labour cost</p>
              <p className="tabular text-2xl font-bold">{currency(totalCost)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Total hours logged</p>
              <p className="tabular text-2xl font-bold">{totalHours.toFixed(1)}h</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Projects costed</p>
              <p className="tabular text-2xl font-bold">{costs.length}</p>
            </Card>
          </div>

          {anyUnrated && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p className="text-muted-foreground">
                Some people logged hours without an hourly rate set, so their time is counted but not costed.
                These totals are therefore a <strong className="text-foreground">minimum</strong>. Set rates on the
                employee&apos;s profile to include them.
              </p>
            </div>
          )}

          <div className="space-y-4">
            {costs.map((p) => {
              const over = p.budget != null && p.cost > p.budget;
              return (
                <Card key={p.projectId}>
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle>{p.projectName}</CardTitle>
                    <div className="flex items-center gap-2">
                      {p.budget != null && (
                        <Badge tone={over ? "destructive" : "muted"}>
                          {over ? "Over budget" : "Budget"} {currency(p.budget)}
                        </Badge>
                      )}
                      <Badge tone="primary">{currency(p.cost)}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <Thead>
                        <tr>
                          <Th>Person</Th>
                          <Th className="text-right">Hours</Th>
                          {showRates && <Th className="text-right">Rate</Th>}
                          <Th className="text-right">Cost</Th>
                        </tr>
                      </Thead>
                      <tbody>
                        {p.byEmployee.map((e, i) => (
                          <Tr key={i}>
                            <Td className="text-sm font-medium">{e.name}</Td>
                            <Td className="tabular text-right text-sm">{e.hours.toFixed(2)}h</Td>
                            {showRates && (
                              <Td className="tabular text-right text-sm text-muted-foreground">
                                {e.rate != null ? currency(e.rate) : "—"}
                              </Td>
                            )}
                            <Td className="tabular text-right text-sm font-medium">
                              {e.rate != null ? currency(e.cost) : <span className="text-muted-foreground">not costed</span>}
                            </Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {p.hours.toFixed(2)} hours logged
                      {p.unratedNames.length > 0 && ` · no rate set for ${p.unratedNames.join(", ")}`}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
