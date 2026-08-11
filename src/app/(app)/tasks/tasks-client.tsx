"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Copy, Volume2, VolumeX } from "lucide-react";
import { Button, Input, Select, Label, Textarea, Badge, Avatar } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { DeadlineTimer } from "@/components/deadline-timer";
import { celebrate, isSoundOn, setSoundOn } from "@/lib/celebrate";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
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
  const [busy, setBusy] = useState(false);

  // Drag-and-drop state: which card is moving, and which column it's over.
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  // Sound preference lives in localStorage. Start with the default and sync
  // after mount so the server and first client render agree (no hydration mismatch).
  const [sound, setSound] = useState(true);
  useEffect(() => setSound(isSoundOn()), []);

  // New-task form: title is controlled so picking a project can prefill it,
  // but only until the user types their own title.
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);

  async function move(id: string, status: string) {
    const before = tasks;
    const task = tasks.find((t) => t.id === id);
    if (!task || task.status === status) return;

    // Optimistic move, then celebrate if this completes the task.
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    if (status === "DONE" && task.status !== "DONE") celebrate();

    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    if (!res.ok) { setTasks(before); alert("Could not move that task."); return; }
    router.refresh();
  }

  async function duplicate(id: string) {
    setBusy(true);
    const res = await fetch(`/api/tasks/${id}/duplicate`, { method: "POST" });
    setBusy(false);
    if (!res.ok) { alert("Could not duplicate that task."); return; }
    const created = await res.json().catch(() => null);
    if (created?.id) setTasks((prev) => [...prev, created as Task]);
    router.refresh();
  }

  function toggleSound() {
    const next = !sound;
    setSound(next);
    setSoundOn(next);
  }

  async function create(form: FormData) {
    const payload = Object.fromEntries(form.entries());
    const res = await fetch("/api/tasks", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    if (res.ok) {
      setOpen(false); setTitle(""); setTitleTouched(false); router.refresh();
    } else alert("Create failed.");
  }

  /** Prefill the title with the project name until the user writes their own. */
  function onProjectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    if (titleTouched) return;
    const name = projects.find((p) => p.id === e.target.value)?.name ?? "";
    setTitle(name);
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-end gap-2">
        <Button variant="ghost" size="icon" onClick={toggleSound}
          aria-label={sound ? "Mute completion sound" : "Unmute completion sound"}
          title={sound ? "Completion sound on" : "Completion sound off"}>
          {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
        </Button>
        {canAssign && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New task</Button>}
      </div>

      <p className="mb-3 text-xs text-muted-foreground">Tip: drag a card into another column to change its status.</p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TASK_STATUSES.map((col) => {
          const items = tasks.filter((t) => t.status === col);
          return (
            <div
              key={col}
              onDragOver={(e) => { e.preventDefault(); setOverCol(col); }}
              onDragLeave={() => setOverCol((c) => (c === col ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                setOverCol(null);
                const id = dragId ?? e.dataTransfer.getData("text/plain");
                if (id) move(id, col);
                setDragId(null);
              }}
              className={cn(
                "rounded-xl border border-border/80 bg-muted/40 p-3 transition-colors",
                overCol === col && "border-primary/60 bg-primary/5"
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: TASK_STATUS_DOT[col] }} />
                  <h3 className="text-sm font-semibold">{TASK_STATUS_LABEL[col]}</h3>
                </div>
                <Badge tone="muted">{items.length}</Badge>
              </div>
              <div className="space-y-2">
                {items.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => { setDragId(t.id); e.dataTransfer.setData("text/plain", t.id); e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnd={() => { setDragId(null); setOverCol(null); }}
                    className={cn(
                      "cursor-grab rounded-lg border border-border/80 bg-card p-3 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-all hover:shadow-[0_2px_8px_rgba(16,24,40,0.08)] active:cursor-grabbing",
                      dragId === t.id && "opacity-40"
                    )}
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight">{t.title}</p>
                      <Badge tone={PRIORITY_TONE[t.priority]}>{t.priority.toLowerCase()}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{t.project.name}</p>

                    {/* Live countdown to the deadline (hidden once done). */}
                    <div className="mt-2">
                      <DeadlineTimer dueDate={t.dueDate} done={t.status === "DONE"} />
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {t.assignee && <Avatar name={t.assignee.name} src={t.assignee.avatarUrl} size={20} />}
                        <span className="text-xs text-muted-foreground">{t.assignee?.name ?? "Unassigned"}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(t.dueDate)}</span>
                    </div>

                    <div className="mt-2 flex items-center gap-1">
                      {/* Keyboard/mobile-accessible fallback for the drag gesture. */}
                      <Select
                        className="h-8 flex-1 text-xs"
                        value={t.status}
                        onChange={(e) => move(t.id, e.target.value)}
                        aria-label={`Change status of ${t.title}`}
                      >
                        {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABEL[s]}</option>)}
                      </Select>
                      {canAssign && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busy}
                          onClick={() => duplicate(t.id)} aria-label={`Duplicate ${t.title}`} title="Duplicate task">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {items.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Nothing here.</p>}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New task"
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button form="task-form" type="submit">Create</Button></>}>
        <form id="task-form" action={create} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="projectId">Project *</Label>
              <Select id="projectId" name="projectId" required onChange={onProjectChange}><option value="">Select…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
            </div>
            <div><Label htmlFor="assigneeId">Assignee</Label>
              <Select id="assigneeId" name="assigneeId"><option value="">—</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>
            </div>
          </div>
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input id="title" name="title" required value={title}
              onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }} />
            <p className="mt-1 text-xs text-muted-foreground">Defaults to the project name — edit it to something more specific.</p>
          </div>
          <div><Label htmlFor="description">Description</Label><Textarea id="description" name="description" /></div>
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
