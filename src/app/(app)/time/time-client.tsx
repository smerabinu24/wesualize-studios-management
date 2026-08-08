"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Square, LogIn, LogOut, Clock } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Select, Badge } from "@/components/ui/primitives";
import { Table, Thead, Th, Td, Tr } from "@/components/ui/table";

type Active = {
  attendance: { startedAt: string } | null;
  task: { startedAt: string; taskId: string; taskTitle: string; projectName: string } | null;
};
type Totals = { todayTask: number; weekTask: number; todayAttendance: number; weekAttendance: number };
type TaskOpt = { id: string; title: string; project: string };
type Entry = { id: string; kind: string; label: string; project: string; startedAt: string; endedAt: string };

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

export function TimeClient({ initialActive, totals, tasks, recent }: { initialActive: Active; totals: Totals; tasks: TaskOpt[]; recent: Entry[] }) {
  const router = useRouter();
  const [active, setActive] = useState(initialActive);
  const [picked, setPicked] = useState("");
  const [busy, setBusy] = useState(false);
  const attSecs = useElapsed(active.attendance?.startedAt ?? null);
  const taskSecs = useElapsed(active.task?.startedAt ?? null);

  async function refresh() {
    const res = await fetch("/api/time/active");
    if (res.ok) setActive(await res.json());
    router.refresh();
  }

  async function clock() {
    setBusy(true);
    await fetch("/api/time/clock", { method: "POST" });
    await refresh();
    setBusy(false);
  }
  async function taskAction(action: "start" | "stop", taskId?: string) {
    setBusy(true);
    await fetch("/api/time/task", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, taskId }) });
    await refresh();
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Attendance */}
        <Card>
          <CardHeader><CardTitle>Workday</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {active.attendance ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
                  <span className="tabular text-3xl font-semibold">{hhmmss(attSecs)}</span>
                </div>
                <Button variant="destructive" disabled={busy} onClick={clock}><LogOut className="h-4 w-4" /> Clock out</Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">You&apos;re not clocked in.</p>
                <Button disabled={busy} onClick={clock}><LogIn className="h-4 w-4" /> Clock in</Button>
              </>
            )}
            <div className="flex gap-4 border-t border-border/70 pt-3 text-xs text-muted-foreground">
              <span>Today: <span className="tabular font-medium text-foreground">{fmtHours(totals.todayAttendance)}</span></span>
              <span>This week: <span className="tabular font-medium text-foreground">{fmtHours(totals.weekAttendance)}</span></span>
            </div>
          </CardContent>
        </Card>

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

      {/* Recent entries */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Clock className="h-4 w-4" /> Recent entries</h3>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No time logged yet.</p>
        ) : (
          <Table>
            <Thead><tr><Th>Type</Th><Th>Details</Th><Th>Date</Th><Th>From–To</Th><Th className="text-right">Duration</Th></tr></Thead>
            <tbody>
              {recent.map((e) => {
                const secs = Math.floor((new Date(e.endedAt).getTime() - new Date(e.startedAt).getTime()) / 1000);
                return (
                  <Tr key={e.id}>
                    <Td><Badge tone={e.kind === "TASK" ? "primary" : "muted"}>{e.kind === "TASK" ? "Task" : "Workday"}</Badge></Td>
                    <Td><span className="font-medium">{e.label}</span>{e.project && <span className="text-muted-foreground"> · {e.project}</span>}</Td>
                    <Td className="text-sm text-muted-foreground">{fmtDay(e.startedAt)}</Td>
                    <Td className="tabular text-sm text-muted-foreground">{fmtClock(e.startedAt)}–{fmtClock(e.endedAt)}</Td>
                    <Td className="tabular text-right font-medium">{(secs / 3600).toFixed(2)}h</Td>
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
