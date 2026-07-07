"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, Input, Select, Label, Textarea, Badge, Avatar } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { formatDate, daysUntil } from "@/lib/utils";
import { TASK_STATUSES, TASK_STATUS_LABEL, TASK_STATUS_DOT, PRIORITY_TONE } from "@/lib/labels";

type Task = {
  id: string; title: string; status: string; priority: string; dueDate: string | null;
  estimatedHours: number; project: { name: string }; assignee: { name: string; avatarUrl: string | null } | null;
};
type Opt = { id: string; name: string };

export function TasksClient({
  initialTasks, projects, employees, canAssign,
}: {
  initialTasks: Task[]; projects: Opt[]; employees: Opt[]; canAssign: boolean;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [open, setOpen] = useState(false);

  async function move(id: string, status: string) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  async function create(form: FormData) {
    const payload = Object.fromEntries(form.entries());
    const res = await fetch("/api/tasks", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    if (res.ok) { setOpen(false); router.refresh(); } else alert("Create failed.");
  }

  return (
    <>
      {canAssign && (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New task</Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TASK_STATUSES.map((col) => {
          const items = tasks.filter((t) => t.status === col);
          return (
            <div key={col} className="rounded-xl border border-border/80 bg-muted/40 p-3">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: TASK_STATUS_DOT[col] }} />
                  <h3 className="text-sm font-semibold">{TASK_STATUS_LABEL[col]}</h3>
                </div>
                <Badge tone="muted">{items.length}</Badge>
              </div>
              <div className="space-y-2">
                {items.map((t) => {
                  const dleft = daysUntil(t.dueDate);
                  return (
                    <div key={t.id} className="rounded-lg border border-border/80 bg-card p-3 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-shadow hover:shadow-[0_2px_8px_rgba(16,24,40,0.08)]">
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">{t.title}</p>
                        <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority.toLowerCase()}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{t.project.name}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {t.assignee && <Avatar name={t.assignee.name} src={t.assignee.avatarUrl} size={20} />}
                          <span className="text-xs text-muted-foreground">{t.assignee?.name ?? "Unassigned"}</span>
                        </div>
                        <span className={`text-xs ${dleft != null && dleft < 0 ? "text-destructive" : "text-muted-foreground"}`}>{formatDate(t.dueDate)}</span>
                      </div>
                      <Select
                        className="mt-2 h-8 text-xs"
                        value={t.status}
                        onChange={(e) => move(t.id, e.target.value)}
                        aria-label={`Change status of ${t.title}`}
                      >
                        {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
                      </Select>
                    </div>
                  );
                })}
                {items.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Nothing here.</p>}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New task"
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button form="task-form" type="submit">Create</Button></>}>
        <form id="task-form" action={create} className="space-y-4">
          <div><Label htmlFor="title">Title *</Label><Input id="title" name="title" required /></div>
          <div><Label htmlFor="description">Description</Label><Textarea id="description" name="description" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="projectId">Project *</Label>
              <Select id="projectId" name="projectId" required><option value="">Select…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
            </div>
            <div><Label htmlFor="assigneeId">Assignee</Label>
              <Select id="assigneeId" name="assigneeId"><option value="">—</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label htmlFor="priority">Priority</Label>
              <Select id="priority" name="priority" defaultValue="MEDIUM"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></Select>
            </div>
            <div><Label htmlFor="dueDate">Due date</Label><Input id="dueDate" name="dueDate" type="date" /></div>
            <div><Label htmlFor="estimatedHours">Est. hours</Label><Input id="estimatedHours" name="estimatedHours" type="number" min={0} defaultValue={0} /></div>
          </div>
        </form>
      </Modal>
    </>
  );
}
