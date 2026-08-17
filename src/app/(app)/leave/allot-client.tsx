"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Home, CalendarRange } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select } from "@/components/ui/primitives";

type Opt = { id: string; name: string };

const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * Administrator allotment: assign a working location to several people across
 * a date range at once. Days off and weekly offs are left alone by the engine.
 */
export function AllotClient({ employees }: { employees: Opt[] }) {
  const router = useRouter();
  const [ids, setIds] = useState<string[]>([]);
  const [kind, setKind] = useState("WORK_FROM_OFFICE");
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const allSelected = ids.length === employees.length && employees.length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (ids.length === 0) { setMsg({ type: "error", text: "Select at least one person." }); return; }

    setBusy(true);
    const res = await fetch("/api/leave/allot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeIds: ids, from, to, kind, reason: reason.trim() || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok || data.error) {
      setMsg({ type: "error", text: data.error ?? "Could not allot those days." });
      return;
    }
    // Say exactly what was skipped — silence here would look like a bug.
    const bits = [`${data.allotted} day${data.allotted === 1 ? "" : "s"} allotted`];
    if (data.skippedWeeklyOff) bits.push(`${data.skippedWeeklyOff} weekly off skipped`);
    if (data.skippedOnLeave) bits.push(`${data.skippedOnLeave} skipped (already on approved leave)`);
    setMsg({ type: "success", text: bits.join(" · ") });
    setIds([]);
    setReason("");
    router.refresh();
  }

  return (
    <Card className="mb-6">
      <CardHeader className="flex-row items-center gap-2">
        <CalendarRange className="h-4 w-4 text-primary" />
        <CardTitle>Allot working location</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="a-kind">Location</Label>
              <Select id="a-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="WORK_FROM_OFFICE">Work from office</option>
                <option value="WORK_FROM_HOME">Work from home</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="a-from">From</Label>
              <Input id="a-from" type="date" value={from}
                onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} required />
            </div>
            <div>
              <Label htmlFor="a-to">To</Label>
              <Input id="a-to" type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="a-reason">Note <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="a-reason" maxLength={200} placeholder="e.g. Client review week" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label>People <span className="font-normal text-muted-foreground">({ids.length} selected)</span></Label>
              <button type="button" className="text-xs font-medium text-primary hover:underline"
                onClick={() => setIds(allSelected ? [] : employees.map((e) => e.id))}>
                {allSelected ? "Clear all" : "Select everyone"}
              </button>
            </div>
            <div className="grid max-h-40 gap-1 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2 lg:grid-cols-3">
              {employees.map((e) => (
                <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                    checked={ids.includes(e.id)}
                    onChange={(ev) => setIds((p) => (ev.target.checked ? [...p, e.id] : p.filter((x) => x !== e.id)))}
                  />
                  {e.name}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={busy}>
              {kind === "WORK_FROM_HOME" ? <Home className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
              Allot {ids.length > 0 ? `${ids.length} ` : ""}
              {ids.length === 1 ? "person" : "people"}
            </Button>
            {msg && (
              <span className={`text-sm ${msg.type === "error" ? "text-destructive" : "text-success"}`}>{msg.text}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Weekly offs are skipped automatically, and anyone with approved leave on a day keeps it — they will not be
            rostered over. Employees can request a change to anything you allot.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
