"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Square, Clock, Plus, Trash2 } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Select, Badge, Input, Label } from "@/components/ui/primitives";
import { Table, Thead, Th, Td, Tr } from "@/components/ui/table";

type Active = {
  attendance: { startedAt: string } | null;
  task: { startedAt: string; taskId: string; taskTitle: string; projectName: string } | null;
};
type Totals = { todayTask: number; weekTask: number; todayAttendance: number; weekAttendance: number };
type TaskOpt = { id: string; title: string; project: string };
type ProjectOpt = { id: string; name: string };
type Entry = { id: string; kind: string; label: string; project: string; startedAt: string; endedAt: string };

const todayStr = () => new Date().toISOString().slice(0, 10);

function useElapsed(startIso: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startIso) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startIso]);
  if (!startIso) return 0;
  return Math.max(0, Math.floor((now - new Date(startIso).getTime()) / 1000));
}

function hhmmss(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}
const fmtHours = (h: number) => `${h.toFixed(1)}h`;
const fmtClock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });

export function TimeClient({ initialActive, totals, tasks, projects, recent }: { initialActive: Active; totals: Totals; tasks: TaskOpt[]; projects: ProjectOpt[]; recent: Entry[] }) {
  const router = useRouter();
  const [active, setActive] = useState(initialActive);
  const [entries, setEntries] = useState(recent);
  const [picked, setPicked] = useState("");
  const [busy, setBusy] = useState(false);

  // Manual "log time" form state
  const [logDate, setLogDate] = useState(todayStr());
  const [logHours, setLogHours] = useState("");
  const [logTaskId, setLogTaskId] = useState("");
  const [newTask, setNewTask] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newProject, setNewProject] = useState("");
  const [logMsg, setLogMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const taskSecs = useElapsed(active.task?.startedAt ?? null);

  async function refresh() {
    const res = await fetch("/api/time/active");
    if (res.ok) setActive(await res.json());
    router.refresh();
  }

  async function taskAction(action: "start" | "stop", taskId?: string) {
    setBusy(true);
    await fetch("/api/time/task", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, taskId }) });
    await refresh();
    setBusy(false);
  }

  async function removeEntry(id: string) {
    if (!confirm("Delete this time entry? Its hours will be removed from the task.")) return;
    setBusy(true);
    const res = await fetch(`/api/time/entry/${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      router.refresh();
    } else {
      alert("Could not delete that entry.");
    }
  }

  async function logTime(e: React.FormEvent) {
    e.preventDefault();
    setLogMsg(null);
    const payload = newTask
      ? { newTaskTitle: newTitle, projectId: newProject, date: logDate, hours: logHours }
      : { taskId: logTaskId, date: logDate, hours: logHours };
    setBusy(true);
    const res = await fetch("/api/time/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setLogMsg({ type: "success", text: "Time logged." });
      setLogHours(""); setLogTaskId(""); setNewTitle(""); setNewProject(""); setNewTask(false);
      router.refresh();
    } else {
      setLogMsg({ type: "error", text: data.error ?? "Could not log time." });
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        {/* Task timer */}
        <Card>
          <CardHeader><CardTitle>Task timer</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {active.task ? (
              <>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                    <span className="tabular text-3xl font-semibold">{hhmmss(taskSecs)}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium">{active.task.taskTitle}</p>
                  <p className="text-xs text-muted-foreground">{active.task.projectName}</p>
                </div>
                <Button variant="destructive" disabled={busy} onClick={() => taskAction("stop")}><Square className="h-4 w-4" /> Stop timer</Button>
              </>
            ) : tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open tasks assigned to you to track.</p>
            ) : (
              <>
                <Select value={picked} onChange={(e) => setPicked(e.target.value)} aria-label="Select a task">
                  <option value="">Select a task…</option>
                  {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}{t.project ? ` · ${t.project}` : ""}</option>)}
                </Select>
                <Button disabled={busy || !picked} onClick={() => taskAction("start", picked)}><Play className="h-4 w-4" /> Start timer</Button>
              </>
            )}
            <div className="flex gap-4 border-t border-border/70 pt-3 text-xs text-muted-foreground">
              <span>Today: <span className="tabular font-medium text-foreground">{fmtHours(totals.todayTask)}</span></span>
              <span>This week: <span className="tabular font-medium text-foreground">{fmtHours(totals.weekTask)}</span></span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Manual end-of-day log */}
      <Card>
        <CardHeader><CardTitle>Log time</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={logTime} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <div>
              <Label htmlFor="logDate">Date</Label>
              <Input id="logDate" type="date" max={todayStr()} value={logDate} onChange={(e) => setLogDate(e.target.value)} required />
            </div>

            {newTask ? (
              <>
                <div>
                  <Label htmlFor="newTitle">New task</Label>
                  <Input id="newTitle" placeholder="Task title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required />
                </div>
                <div>
                  <Label htmlFor="newProject">Project</Label>
                  <Select id="newProject" value={newProject} onChange={(e) => setNewProject(e.target.value)} required>
                    <option value="">Select project…</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Select>
                </div>
              </>
            ) : (
              <div className="lg:col-span-2">
                <Label htmlFor="logTask">Task</Label>
                <Select id="logTask" value={logTaskId} onChange={(e) => setLogTaskId(e.target.value)} required>
                  <option value="">Select a task…</option>
                  {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}{t.project ? ` · ${t.project}` : ""}</option>)}
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="logHours">Hours</Label>
              <Input id="logHours" type="number" step="0.25" min="0.25" max="24" placeholder="e.g. 3.5" value={logHours} onChange={(e) => setLogHours(e.target.value)} required />
            </div>

            <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4">
              <Button type="submit" disabled={busy}><Plus className="h-4 w-4" /> Log time</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setNewTask(!newTask); setLogTaskId(""); setNewTitle(""); setNewProject(""); }}>
                {newTask ? "Pick an existing task" : "+ Log against a new task"}
              </Button>
              {logMsg && (
                <span className={`text-sm ${logMsg.type === "error" ? "text-destructive" : "text-success"}`}>{logMsg.text}</span>
              )}
            </div>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">Logged hours roll into the task&apos;s actual hours and your totals.</p>
        </CardContent>
      </Card>

      {/* Recent entries */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Clock className="h-4 w-4" /> Recent entries</h3>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No time logged yet.</p>
        ) : (
          <Table>
            <Thead><tr><Th>Type</Th><Th>Details</Th><Th>Date</Th><Th>From–To</Th><Th className="text-right">Duration</Th><Th className="text-right">Actions</Th></tr></Thead>
            <tbody>
              {entries.map((e) => {
                const secs = Math.floor((new Date(e.endedAt).getTime() - new Date(e.startedAt).getTime()) / 1000);
                return (
                  <Tr key={e.id}>
                    <Td><Badge tone={e.kind === "TASK" ? "primary" : "muted"}>{e.kind === "TASK" ? "Task" : "Workday"}</Badge></Td>
                    <Td><span className="font-medium">{e.label}</span>{e.project && <span className="text-muted-foreground"> · {e.project}</span>}</Td>
                    <Td className="text-sm text-muted-foreground">{fmtDay(e.startedAt)}</Td>
                    <Td className="tabular text-sm text-muted-foreground">{fmtClock(e.startedAt)}–{fmtClock(e.endedAt)}</Td>
                    <Td className="tabular text-right font-medium">{(secs / 3600).toFixed(2)}h</Td>
                    <Td className="text-right">
                      <Button variant="ghost" size="icon" disabled={busy} aria-label="Delete entry" onClick={() => removeEntry(e.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
