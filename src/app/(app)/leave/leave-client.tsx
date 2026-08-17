"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Trash2 } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Badge, Select } from "@/components/ui/primitives";
import { Table, Thead, Th, Td, Tr } from "@/components/ui/table";

type Leave = {
  id: string; date: string; type: string; reason: string | null;
  status: string; decisionNote: string | null; kind: string;
};

const KIND_LABEL: Record<string, string> = { LEAVE: "Leave", WORK_FROM_HOME: "Work from home" };

const STATUS_TONE: Record<string, "success" | "warning" | "destructive"> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "destructive",
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export function LeaveClient({
  initialLeaves,
  balance,
  weeklyOffDay,
}: {
  initialLeaves: Leave[];
  balance: number;
  weeklyOffDay: number;
}) {
  const router = useRouter();
  const [leaves, setLeaves] = useState(initialLeaves);
  const [date, setDate] = useState(todayStr());
  const [reason, setReason] = useState("");
  const [kind, setKind] = useState("LEAVE");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);

  // Warn before submitting if the chosen day is already their weekly off.
  const picked = date ? new Date(`${date}T00:00:00`) : null;
  const pickedIsWeeklyOff = picked != null && picked.getDay() === weeklyOffDay;
  // Working from home is paid work, so the balance warning does not apply.
  const willBeUnpaid = balance <= 0 && kind === "LEAVE";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    const res = await fetch("/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, kind, reason: reason.trim() || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      const unpaid = data.type === "UNPAID" ? " It is unpaid — your balance was already used up." : "";
      const what = kind === "WORK_FROM_HOME" ? "Work-from-home request" : "Leave request";
      setMsg({
        type: "success",
        text:
          data.status === "PENDING"
            ? `${what} submitted — awaiting approval.${unpaid}`
            : `${what.replace(" request", "")} recorded.${unpaid}`,
      });
      setReason("");
      router.refresh();
    } else {
      setMsg({ type: "error", text: data.error ?? "Could not record that leave." });
    }
  }

  async function remove(id: string) {
    if (!confirm("Cancel this leave? If it was a paid day, it returns to your balance.")) return;
    setBusy(true);
    const res = await fetch(`/api/leave/${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      setLeaves((prev) => prev.filter((l) => l.id !== id));
      router.refresh();
    } else alert("Could not cancel that leave.");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Book leave or work from home</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <div>
              <Label htmlFor="kind">Request type</Label>
              <Select id="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="LEAVE">Leave (day off)</option>
                <option value="WORK_FROM_HOME">Work from home</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="lg:col-span-2">
              <Label htmlFor="reason">Reason <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="reason" maxLength={200} placeholder="e.g. Family function" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
              <Button type="submit" disabled={busy || pickedIsWeeklyOff}>
                <CalendarPlus className="h-4 w-4" /> {kind === "WORK_FROM_HOME" ? "Request WFH" : "Book leave"}
              </Button>
              {pickedIsWeeklyOff && (
                <span className="text-sm text-muted-foreground">
                  That day is already your weekly off — no need to book it.
                </span>
              )}
              {!pickedIsWeeklyOff && willBeUnpaid && (
                <span className="text-sm text-warning">
                  Your balance is used up, so this will be recorded as unpaid.
                </span>
              )}
              {msg && (
                <span className={`text-sm ${msg.type === "error" ? "text-destructive" : "text-success"}`}>{msg.text}</span>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-3 text-lg font-semibold">Your requests</h3>
        {leaves.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing requested yet.</p>
        ) : (
          <Table>
            <Thead><tr><Th>Date</Th><Th>Request</Th><Th>Status</Th><Th>Paid</Th><Th>Reason</Th><Th className="text-right">Actions</Th></tr></Thead>
            <tbody>
              {leaves.map((l) => (
                <Tr key={l.id}>
                  <Td className="text-sm font-medium">{fmt(l.date)}</Td>
                  <Td>
                    <Badge tone={l.kind === "WORK_FROM_HOME" ? "primary" : "muted"}>{KIND_LABEL[l.kind] ?? l.kind}</Badge>
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[l.status] ?? "muted"}>{l.status.toLowerCase()}</Badge>
                    {l.decisionNote && <p className="mt-0.5 max-w-xs text-xs text-muted-foreground">{l.decisionNote}</p>}
                  </Td>
                  <Td><Badge tone={l.type === "PAID" ? "success" : "warning"}>{l.type.toLowerCase()}</Badge></Td>
                  <Td className="text-sm text-muted-foreground">{l.reason || <span className="italic opacity-60">—</span>}</Td>
                  <Td className="text-right">
                    <Button variant="ghost" size="icon" disabled={busy} aria-label="Cancel leave" onClick={() => remove(l.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
