import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { archiveStaleCompleted } from "@/lib/archive";

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

    // Piggyback the auto-archive sweep on the schedule that already exists.
    // It is indexed and idempotent, matching zero rows on almost every run,
    // and it can only touch work already finished for the grace period — so
    // it stays safe on this deliberately public endpoint.
    let archived: { tasks: number; projects: number } | null = null;
    try {
      archived = await archiveStaleCompleted();
    } catch {
      // Never let housekeeping turn a healthy app into a failed health check.
    }

    return NextResponse.json(
      { ok: true, db: "up", latencyMs: Date.now() - startedAt, archived },
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
