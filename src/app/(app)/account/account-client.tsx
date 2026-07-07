"use client";

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@/components/ui/primitives";

export function AccountClient() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next !== confirm) {
      setMsg({ type: "error", text: "New passwords do not match." });
      return;
    }
    setLoading(true);
    const res = await fetch("/api/account/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) {
      setMsg({ type: "success", text: data.message ?? "Password updated." });
      setCurrent(""); setNext(""); setConfirm("");
    } else {
      setMsg({ type: "error", text: data.error ?? "Something went wrong." });
    }
  }

  return (
    <Card className="max-w-lg">
      <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="current">Current password</Label>
            <Input id="current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="next">New password</Label>
            <Input id="next" type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required />
            <p className="mt-1 text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
          <div>
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input id="confirm" type="password" autoComplete="new-password" minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>

          {msg && (
            <p
              role={msg.type === "error" ? "alert" : "status"}
              className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm ${msg.type === "error" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}
            >
              {msg.type === "success" && <CheckCircle2 className="h-4 w-4" />}
              {msg.text}
            </p>
          )}

          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
