import { prisma } from "@/lib/prisma";

/** Append-only audit log helper. Never throws into the request path. */
export async function logActivity(opts: {
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        userId: opts.userId ?? null,
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId,
        metadata: opts.metadata as object | undefined,
        ip: opts.ip ?? undefined,
      },
    });
  } catch {
    // swallow — auditing must not break the user action
  }
}
