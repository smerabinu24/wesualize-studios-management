"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Copy, Volume2, VolumeX, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Button, Input, Select, Label, Textarea, Badge, Avatar } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { DeadlineTimer } from "@/components/deadline-timer";
import { TaskDetailModal, type TaskDetail } from "./task-detail";
import { celebrate, isSoundOn, setSoundOn } from "@/lib/celebrate";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { TASK_STATUSES, TASK_STATUS_LABEL, TASK_STATUS_DOT, PRIORITY_TONE } from "@/lib/labels";

type Person = { id?: string; name: string; avatarUrl: string | null };
type Task = TaskDetail;
type Opt = { id: string; name: string };

/** Mirrors ARCHIVE_AFTER_DAYS in lib/archive.ts — display copy only. */
const ARCHIVE_DAYS = 7;

export function TasksClient({
  initialTasks, projects, employees, canAssign, showArchived = false,
}: {
  initialTasks: Task[]; projects: Opt[]; employees: Opt[]; canAssign: boolean; showArchived?: boolean;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Drag-and-drop state: which card is moving, and which column it's over.
  const [detail, setDetail] = useState<Task | null>(null);
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
  // Extra assignees beyond the primary owner.
  const [collabs, setCollabs] = useState<string[]>([]);

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

  /** Hide from the board but keep every record. Reversible. */
  async function archive(id: string, archived: boolean) {
    setBusy(true);
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived }),
    });
    setBusy(false);
    if (!res.ok) { alert("Could not archive that task."); return; }
    setTasks((prev) => prev.filter((t) => t.id !== id));
    router.refresh();
  }

  /** Permanent, unlike archiving — so it is spelled out and confirmed. */
  async function destroy(id: string, title: string) {
    if (!confirm(
      `Permanently delete "${title}"?\n\nThis erases the task and its logged time entries. ` +
      `Hours already counted toward reports will disappear.\n\nArchive instead if you just want it off the board.`
    )) return;
    setBusy(true);
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) { alert("Could not delete that task."); return; }
    setTasks((prev) => prev.filter((t) => t.id !== id));
    router.refresh();
  }

  async function create(form: FormData) {
    const payload = { ...Object.fromEntries(form.entries()), collaboratorIds: collabs };
    const res = await fetch("/api/tasks", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    if (res.ok) {
      setOpen(false); setTitle(""); setTitleTouched(false); setCollabs([]); router.refresh();
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
        <Link
          href={showArchived ? "/tasks" : "/tasks?archived=1"}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          <Archive className="h-4 w-4" />
          {showArchived ? "Back to board" : "Archived"}
        </Link>
        <Button variant="ghost" size="icon" onClick={toggleSound}
          aria-label={sound ? "Mute completion sound" : "Unmute completion sound"}
          title={sound ? "Completion sound on" : "Completion sound off"}>
          {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
        </Button>
        {canAssign && !showArchived && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New task</Button>}
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        {showArchived
          ? `Completed work auto-archives after ${ARCHIVE_DAYS} days. Nothing here is deleted — restore anything you need.`
          : "Tip: drag a card into another column to change its status."}
      </p>

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
                    onClick={() => setDetail(t)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") setDetail(t); }}
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
                        {/* Primary owner first, then any collaborators. */}
                        <div className="flex -space-x-1.5">
                          {t.assignee && <Avatar name={t.assignee.name} src={t.assignee.avatarUrl} size={20} />}
                          {t.collaborators?.slice(0, 3).map((c, i) => (
                            <span key={c.id ?? i} className="ring-2 ring-card rounded-full" title={c.name}>
                              <Avatar name={c.name} src={c.avatarUrl} size={20} />
                            </span>
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {t.assignee?.name ?? "Unassigned"}
                          {t.collaborators?.length ? ` +${t.collaborators.length}` : ""}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">{formatDate(t.dueDate)}</span>
                    </div>

                    {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
                    <div className="mt-2 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
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
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busy}
                            onClick={() => duplicate(t.id)} aria-label={`Duplicate ${t.title}`} title="Duplicate task">
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busy}
                            onClick={() => archive(t.id, !showArchived)}
                            aria-label={`${showArchived ? "Restore" : "Archive"} ${t.title}`}
                            title={showArchived ? "Restore to board" : "Archive (keeps all data)"}>
                            {showArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={busy}
                            onClick={() => destroy(t.id, t.title)}
                            aria-label={`Delete ${t.title}`} title="Delete permanently">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </>
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

      {detail && (
        <TaskDetailModal
          task={detail}
          employees={employees}
          projects={projects}
          canEdit={canAssign}
          onClose={() => setDetail(null)}
          onSaved={() => router.refresh()}
        />
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New task"
        footer={<><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button form="task-form" type="submit">Create</Button></>}>
        <form id="task-form" action={create} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="projectId">Project *</Label>
              <Select id="projectId" name="projectId" required onChange={onProjectChange}><option value="">Select…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
            </div>
            <div><Label htmlFor="assigneeId">Primary assignee</Label>
              <Select id="assigneeId" name="assigneeId"><option value="">—</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select>
            </div>
          </div>

          <div>
            <Label>Also working on this <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <div className="mt-1 max-h-32 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {employees.map((e) => (
                <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                    checked={collabs.includes(e.id)}
                    onChange={(ev) =>
                      setCollabs((prev) => (ev.target.checked ? [...prev, e.id] : prev.filter((x) => x !== e.id)))
                    }
                  />
                  {e.name}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Collaborators see the task in their list and can log time against it.
            </p>
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
