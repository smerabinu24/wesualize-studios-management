"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Trash2 } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Badge } from "@/components/ui/primitives";
import { Table, Thead, Th, Td, Tr } from "@/components/ui/table";

type Leave = {
  id: string; date: string; type: string; reason: string | null;
  status: string; decisionNote: string | null;
};

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
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);

  // Warn before submitting if the chosen day is already their weekly off.
  const picked = date ? new Date(`${date}T00:00:00`) : null;
  const pickedIsWeeklyOff = picked != null && picked.getDay() === weeklyOffDay;
  const willBeUnpaid = balance <= 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    const res = await fetch("/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, reason: reason.trim() || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      const unpaid = data.type === "UNPAID" ? " It is unpaid — your balance was already used up." : "";
      setMsg({
        type: "success",
        text:
          data.status === "PENDING"
            ? `Request submitted — awaiting approval.${unpaid}`
            : `Leave recorded.${unpaid}`,
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
        <CardHeader><CardTitle>Book a leave</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:items-end">
            <div>
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="lg:col-span-2">
              <Label htmlFor="reason">Reason <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="reason" maxLength={200} placeholder="e.g. Family function" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
              <Button type="submit" disabled={busy || pickedIsWeeklyOff}>
                <CalendarPlus className="h-4 w-4" /> Book leave
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
        <h3 className="mb-3 text-lg font-semibold">Your leave history</h3>
        {leaves.length === 0 ? (
          <p className="text-sm text-muted-foreground">No leave recorded yet.</p>
        ) : (
          <Table>
            <Thead><tr><Th>Date</Th><Th>Status</Th><Th>Type</Th><Th>Reason</Th><Th className="text-right">Actions</Th></tr></Thead>
            <tbody>
              {leaves.map((l) => (
                <Tr key={l.id}>
                  <Td className="text-sm font-medium">{fmt(l.date)}</Td>
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
