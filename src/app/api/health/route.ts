import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Must run on Node (Prisma) and never be cached — a cached response would
// stop reaching the database and defeat the point of the ping.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public health check. Pinged on a schedule to keep the Neon compute awake
 * (it autosuspends after 5 min idle on the free plan) and the Lambda warm.
 * Deliberately unauthenticated and as cheap as possible: one `SELECT 1`.
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { ok: true, db: "up", latencyMs: Date.now() - startedAt },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    // 503 so an uptime monitor treats it as a real outage.
    return NextResponse.json(
      { ok: false, db: "down", latencyMs: Date.now() - startedAt },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
