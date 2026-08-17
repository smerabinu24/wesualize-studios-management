"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button, Input, Select, Label, Textarea, Badge, Avatar } from "@/components/ui/primitives";
import { DeadlineTimer } from "@/components/deadline-timer";
import { TASK_STATUSES, TASK_STATUS_LABEL, PRIORITY_TONE } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

type Person = { id?: string; name: string; avatarUrl: string | null };
export type TaskDetail = {
  id: string; title: string; description?: string | null; status: string; priority: string;
  dueDate: string | null; estimatedHours: number; actualHours?: number;
  createdAt?: string; completedAt?: string | null; assignedByName?: string | null;
  projectId?: string; project: { name: string };
  assigneeId?: string | null; assignee: Person | null; collaborators?: Person[];
};
type Opt = { id: string; name: string };

const dateValue = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");

/**
 * Task details, with inline editing for those who can assign work.
 * Everyone else gets the same panel read-only — seeing the brief matters even
 * when changing it is not your job.
 */
export function TaskDetailModal({
  task, employees, projects, canEdit, onClose, onSaved,
}: {
  task: TaskDetail;
  employees: Opt[];
  projects: Opt[];
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collabs, setCollabs] = useState<string[]>(
    (task.collaborators ?? []).map((c) => c.id).filter((id): id is string => Boolean(id))
  );

  async function save(form: FormData) {
    setError(null);
    setBusy(true);
    const payload: Record<string, unknown> = {
      ...Object.fromEntries(form.entries()),
      collaboratorIds: collabs,
    };
    // actualHours is derived from logged time — never send it back.
    delete payload.actualHours;

    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not save those changes.");
      return;
    }
    setEditing(false);
    onSaved();
    onClose();
  }

  const footer = editing ? (
    <>
      <Button variant="outline" onClick={() => setEditing(false)} disabled={busy}>Cancel</Button>
      <Button form="task-detail-form" type="submit" disabled={busy}>Save changes</Button>
    </>
  ) : (
    <>
      <Button variant="outline" onClick={onClose}>Close</Button>
      {canEdit && <Button onClick={() => setEditing(true)}>Edit task</Button>}
    </>
  );

  return (
    <Modal open onClose={onClose} title={editing ? "Edit task" : task.title} footer={footer}>
      {editing ? (
        <form id="task-detail-form" action={save} className="space-y-4">
          <div>
            <Label htmlFor="d-title">Title *</Label>
            <Input id="d-title" name="title" required defaultValue={task.title} />
          </div>
          <div>
            <Label htmlFor="d-desc">Description</Label>
            <Textarea id="d-desc" name="description" rows={4} defaultValue={task.description ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="d-assignee">Primary assignee</Label>
              <Select id="d-assignee" name="assigneeId" defaultValue={task.assigneeId ?? ""}>
                <option value="">—</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="d-status">Status</Label>
              <Select id="d-status" name="status" defaultValue={task.status}>
                {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
              </Select>
            </div>
          </div>

          <div>
            <Label>Also working on this</Label>
            <div className="mt-1 max-h-28 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {employees.map((e) => (
                <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                    checked={collabs.includes(e.id)}
                    onChange={(ev) =>
                      setCollabs((p) => (ev.target.checked ? [...p, e.id] : p.filter((x) => x !== e.id)))
                    }
                  />
                  {e.name}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="d-priority">Priority</Label>
              <Select id="d-priority" name="priority" defaultValue={task.priority}>
                <option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="d-due">Due date</Label>
              <Input id="d-due" name="dueDate" type="date" defaultValue={dateValue(task.dueDate)} />
            </div>
            <div>
              <Label htmlFor="d-est">Est. hours</Label>
              <Input id="d-est" name="estimatedHours" type="number" min={0} step="0.5" defaultValue={task.estimatedHours} />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Actual hours ({(task.actualHours ?? 0).toFixed(2)}h) come from logged time and cannot be edited here.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority.toLowerCase()}</Badge>
            <Badge tone="muted">{TASK_STATUS_LABEL[task.status]}</Badge>
            <DeadlineTimer dueDate={task.dueDate} done={task.status === "DONE"} />
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground">Description</p>
            <p className="mt-0.5 whitespace-pre-wrap text-sm">
              {task.description || <span className="italic text-muted-foreground">No description.</span>}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Project</p>
              <p className="mt-0.5">{task.project.name}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Due</p>
              <p className="mt-0.5">{formatDate(task.dueDate)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Assignee</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                {task.assignee
                  ? <><Avatar name={task.assignee.name} src={task.assignee.avatarUrl} size={20} />{task.assignee.name}</>
                  : <span className="text-muted-foreground">Unassigned</span>}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Also working on this</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                {task.collaborators?.length
                  ? task.collaborators.map((c, i) => (
                      <span key={c.id ?? i} className="flex items-center gap-1">
                        <Avatar name={c.name} src={c.avatarUrl} size={18} />
                        <span className="text-xs">{c.name}</span>
                      </span>
                    ))
                  : <span className="text-muted-foreground">—</span>}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Hours</p>
              <p className="tabular mt-0.5">
                {(task.actualHours ?? 0).toFixed(2)}h logged
                {task.estimatedHours > 0 && (
                  <span className="text-muted-foreground"> / {task.estimatedHours}h estimated</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Created</p>
              <p className="mt-0.5">
                {formatDate(task.createdAt)}
                {task.assignedByName && <span className="text-muted-foreground"> by {task.assignedByName}</span>}
              </p>
            </div>
          </div>

          {!canEdit && (
            <p className="text-xs text-muted-foreground">
              Only administrators and team leads can change task details.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
