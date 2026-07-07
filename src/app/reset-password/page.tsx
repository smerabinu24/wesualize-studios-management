"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Input, Label } from "@/components/ui/primitives";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState<"request" | "reset">("request");
  const [token, setToken] = useState("");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/password/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setMsg(data.message);
    // Dev convenience: token returned inline so the flow is testable without email.
    if (data.devToken) {
      setToken(data.devToken);
      setUserId(data.devUserId);
      setStage("reset");
    }
  }

  async function doReset(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, token, password }),
    });
    const data = await res.json();
    setMsg(data.message);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md p-8">
        <h1 className="mb-1 text-xl font-semibold">Reset password</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {stage === "request" ? "Enter your email to receive a reset link." : "Enter a new password."}
        </p>

        {stage === "request" ? (
          <form onSubmit={requestReset} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full">Send reset link</Button>
          </form>
        ) : (
          <form onSubmit={doReset} className="space-y-4">
            <div>
              <Label htmlFor="password">New password</Label>
              <Input id="password" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
              <p className="mt-1 text-xs text-muted-foreground">Minimum 8 characters.</p>
            </div>
            <Button type="submit" className="w-full">Update password</Button>
          </form>
        )}

        {msg && <p role="status" className="mt-4 rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{msg}</p>}

        <div className="mt-6 text-sm">
          <Link href="/login" className="text-primary hover:underline">Back to sign in</Link>
        </div>
      </Card>
    </div>
  );
}
