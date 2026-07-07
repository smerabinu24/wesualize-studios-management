"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button, Card } from "@/components/ui/primitives";

export default function AppError({ error }: { error: Error & { status?: number } }) {
  const forbidden = error.message === "Forbidden";
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md p-8 text-center">
        <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-destructive" />
        <h2 className="text-lg font-semibold">{forbidden ? "Access denied" : "Something went wrong"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {forbidden ? "You don't have permission to view this page." : "An unexpected error occurred."}
        </p>
        <Link href="/dashboard" className="mt-4 inline-block"><Button>Back to dashboard</Button></Link>
      </Card>
    </div>
  );
}
