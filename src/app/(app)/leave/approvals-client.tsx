"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Inbox } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Avatar, Badge, Input } from "@/components/ui/primitives";

type Pending = {
  id: string;
  employeeName: string;
  avatarUrl: string | null;
  date: string;
  type: string;
  kind: string;
  requestedKind: string | null;
  allotted: boolean;
  reason: string | null;
};

const KIND_LABEL: Record<string, string> = {
  LEAVE: "Leave",
  WORK_FROM_HOME: "Work from home",
  WORK_FROM_OFFICE: "Work from office",
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: "numeric" });

/** Administrator queue: approve or reject each outstanding leave request. */
export function ApprovalsClient({ pending }: { pending: Pending[] }) {
  const router = useRouter();
  const [items, setItems] = useState(pending);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(id: string, approve: boolean) {
    setBusy(id);
    const res = await fetch(`/api/leave/${id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve, note: notes[id]?.trim() || undefined }),
    });
    setBusy(null);
    if (!res.ok) { alert("Could not save that decision."); return; }
    setItems((prev) => prev.filter((p) => p.id !== id));
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <Card className="mb-6">
        <CardContent className="flex items-center gap-3 py-6 text-sm text-muted-foreground">
          <Inbox className="h-5 w-5" />
          No requests waiting for approval.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6 border-warning/40">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Requests awaiting your approval</CardTitle>
        <Badge tone="warning">{items.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((p) => (
          <div key={p.id} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <Avatar name={p.employeeName} src={p.avatarUrl} size={28} />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{p.employeeName}</p>
                    {p.requestedKind ? (
                      <Badge tone="warning">
                        Change · {KIND_LABEL[p.kind] ?? p.kind} → {KIND_LABEL[p.requestedKind] ?? p.requestedKind}
                      </Badge>
                    ) : (
                      <Badge tone={p.kind === "LEAVE" ? "muted" : "primary"}>
                        {KIND_LABEL[p.kind] ?? p.kind}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {fmt(p.date)}
                    {!p.requestedKind && p.kind === "LEAVE" && p.type === "UNPAID" && <span className="text-warning"> · unpaid (no balance left)</span>}
                    {!p.requestedKind && p.kind !== "LEAVE" && <span> · costs no leave allowance</span>}
                    {p.requestedKind && p.allotted && <span> · you allotted this day</span>}
                  </p>
                  {p.reason && <p className="mt-1 text-sm text-muted-foreground">&ldquo;{p.reason}&rdquo;</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  className="h-9 w-44"
                  placeholder="Note (optional)"
                  maxLength={200}
                  value={notes[p.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))}
                  aria-label={`Decision note for ${p.employeeName}`}
                />
                <Button size="sm" disabled={busy === p.id} onClick={() => decide(p.id, true)}>
                  <Check className="h-4 w-4" /> Approve
                </Button>
                <Button size="sm" variant="destructive" disabled={busy === p.id} onClick={() => decide(p.id, false)}>
                  <X className="h-4 w-4" /> Deny
                </Button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
