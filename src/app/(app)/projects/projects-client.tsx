"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Search, FolderKanban } from "lucide-react";
import { Button, Input, Select, Label, Textarea, Badge, Card, EmptyState } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { formatDate, daysUntil } from "@/lib/utils";
import { PROJECT_STATUS_LABEL, STATUS_TONE, PRIORITY_TONE } from "@/lib/labels";

type Health = { healthScore: number; risk: "low" | "medium" | "high"; completionRate: number };
type Row = {
  id: string; name: string; status: string; priority: string; deadline: string | null;
  client: { companyName: string | null; clientName: string } | null;
  lead: { name: string } | null;
  _count: { members: number; tasks: number };
};
type Opt = { id: string; name: string };

export function ProjectsClient({
  projects, health, clients, leads, canManage,
}: {
  projects: Row[]; health: Record<string, Health>; clients: Opt[]; leads: Opt[]; canManage: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = projects.filter((p) => (!q || p.name.toLowerCase().includes(q.toLowerCase())) && (!status || p.status === status));

  async function save(form: FormData) {
    const payload = Object.fromEntries(form.entries());
    const res = await fetch("/api/projects", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    if (res.ok) { setOpen(false); router.refresh(); } else alert("Save failed.");
  }

  const riskTone = { high: "destructive", medium: "warning", low: "success" } as const;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search projects…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search projects" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44" aria-label="Filter by status">
          <option value="">All statuses</option>
          {Object.entries(PROJECT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        {canManage && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New project</Button>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((p) => {
          const h = health[p.id];
          const dleft = daysUntil(p.deadline);
          return (
            <Link key={p.id} href={`/projects/${p.id}`} className="group">
              <Card className="h-full p-5 transition-shadow group-hover:shadow-md">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight">{p.name}</h3>
                  <Badge tone={STATUS_TONE[p.status]}>{PROJECT_STATUS_LABEL[p.status]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{p.client?.companyName ?? p.client?.clientName ?? "Internal"}</p>

                {h && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Health</span>
                      <span className="tabular font-medium">{h.healthScore}/100</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${h.healthScore}%`, background: h.risk === "high" ? "hsl(var(--destructive))" : h.risk === "medium" ? "hsl(var(--warning))" : "hsl(var(--success))" }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge tone={PRIORITY_TONE[p.priority]}>{p.priority.toLowerCase()}</Badge>
                  {h && <Badge tone={riskTone[h.risk]}>{h.risk} risk</Badge>}
                  <span>{p._count.members} members</span>
                  <span>· {p._count.tasks} tasks</span>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Deadline: {formatDate(p.deadline)} {dleft != null && p.status !== "COMPLETED" && (
                    <span className={dleft < 0 ? "text-destructive font-medium" : ""}>({dleft < 0 ? `${-dleft}d overdue` : `${dleft}d left`})</span>
                  )}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <EmptyState
          icon={FolderKanban}
          title="No projects found"
          description={q || status ? "No projects match your current search or filters." : "Create your first project to start tracking production."}
          action={canManage ? <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New project</Button> : undefined}
          className="mt-2"
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New project"
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button form="proj-form" type="submit">Create</Button></>}>
        <form id="proj-form" action={save} className="space-y-4">
          <div><Label htmlFor="name">Project name *</Label><Input id="name" name="name" required /></div>
          <div><Label htmlFor="description">Description</Label><Textarea id="description" name="description" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="clientId">Client</Label>
              <Select id="clientId" name="clientId"><option value="">—</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
            </div>
            <div><Label htmlFor="leadId">Team lead</Label>
              <Select id="leadId" name="leadId"><option value="">—</option>{leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue="PLANNING">{Object.entries(PROJECT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
            </div>
            <div><Label htmlFor="priority">Priority</Label>
              <Select id="priority" name="priority" defaultValue="MEDIUM"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="deadline">Deadline</Label><Input id="deadline" name="deadline" type="date" /></div>
            <div><Label htmlFor="budget">Budget (₹)</Label><Input id="budget" name="budget" type="number" min={0} placeholder="e.g. 250000" /></div>
          </div>
        </form>
      </Modal>
    </>
  );
}
