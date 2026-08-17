import { Wallet, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireCan } from "@/lib/session";
import { getProjectCosts } from "@/lib/cost";
import { Card, CardContent, CardHeader, CardTitle, Badge, EmptyState } from "@/components/ui/primitives";
import { Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { can } from "@/lib/rbac";
import { currency } from "@/lib/utils";

export default async function CostsPage() {
  // Admin-only: `finance:view` is granted to no other role. Anyone else is
  // rejected here before a single cost figure is calculated.
  const user = await requireCan("finance:view");
  const showRates = can(user.role, "finance:manage");
  const costs = await getProjectCosts();

  const totalCost = costs.reduce((s, p) => s + p.cost, 0);
  const totalHours = costs.reduce((s, p) => s + p.hours, 0);
  // Only projects that actually have a budget contribute to the comparison,
  // otherwise the total would look under-spent purely because a budget is missing.
  const budgeted = costs.filter((p) => p.budget != null && p.budget > 0);
  const totalBudget = budgeted.reduce((s, p) => s + (p.budget ?? 0), 0);
  const budgetedCount = budgeted.length;
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
              <p className="tabular text-2xl font-bold">
                <span className={totalBudget > 0 && totalCost > totalBudget ? "text-destructive" : ""}>{currency(totalCost)}</span>
                {totalBudget > 0 && (
                  <span className="text-base font-normal text-muted-foreground"> / {currency(totalBudget)}</span>
                )}
              </p>
              {totalBudget > 0 && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  across {budgetedCount} budgeted {budgetedCount === 1 ? "project" : "projects"}
                </p>
              )}
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
              const hasBudget = p.budget != null && p.budget > 0;
              const over = hasBudget && p.cost > p.budget!;
              // Percentage of budget consumed; the bar caps at 100% but the
              // number does not, so "180% used" stays visible.
              const pct = hasBudget ? (p.cost / p.budget!) * 100 : 0;
              const nearing = hasBudget && !over && pct >= 80;
              const barTone = over ? "bg-destructive" : nearing ? "bg-warning" : "bg-primary";

              return (
                <Card key={p.projectId}>
                  <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
                    <CardTitle>{p.projectName}</CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="tabular text-sm font-semibold">
                        <span className={over ? "text-destructive" : "text-foreground"}>{currency(p.cost)}</span>
                        <span className="font-normal text-muted-foreground">
                          {hasBudget ? ` / ${currency(p.budget)} spent` : " spent · no budget set"}
                        </span>
                      </span>
                      {over && <Badge tone="destructive">Over budget</Badge>}
                      {nearing && <Badge tone="warning">{Math.round(pct)}% used</Badge>}
                    </div>
                  </CardHeader>

                  {hasBudget && (
                    <div className="px-6 pb-1">
                      <div
                        className="h-2 overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-valuenow={Math.round(pct)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${p.projectName} budget used`}
                      >
                        <div className={`h-full rounded-full ${barTone}`} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                        <span>{Math.round(pct)}% of budget used</span>
                        <span className="tabular">
                          {over
                            ? `${currency(p.cost - p.budget!)} over`
                            : `${currency(p.budget! - p.cost)} remaining`}
                        </span>
                      </div>
                    </div>
                  )}
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
