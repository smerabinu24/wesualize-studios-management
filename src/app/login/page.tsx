"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button, Card, Input, Label } from "@/components/ui/primitives";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "22px 22px" }}
        />
        <div className="relative">
          <span className="text-lg font-semibold tracking-tight">Wesualize Studios</span>
        </div>
        <div className="relative">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Run the studio<br />with total clarity.
          </h2>
          <p className="mt-3 max-w-sm text-sm text-primary-foreground/80">
            Projects, workload, deadlines and team performance — one executive view, updated in real time.
          </p>
        </div>
        <div className="relative text-xs text-primary-foreground/60">© {new Date().getFullYear()} Wesualize Studios</div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-background p-4 sm:p-8">
      <Card className="w-full max-w-md border-0 p-8 shadow-none">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo size={64} />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to Wesualize Studios</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in
          </Button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <Link href="/reset-password" className="text-primary hover:underline">
            Forgot password?
          </Link>
        </div>

      </Card>
      </div>
    </div>
  );
}
