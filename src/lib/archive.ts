/**
 * Archiving: completed work disappears from the active board after a grace
 * period, but nothing is ever deleted here — `archivedAt` is just a flag.
 * Time entries, logged hours, project costs and historical reports all stay
 * intact, and anything archived can be restored.
 *
 * Actual deletion is a separate, explicit, user-initiated action.
 */
import { prisma } from "@/lib/prisma";
import { ProjectStatus, TaskStatus } from "@prisma/client";

/** Days a completed item stays visible before it auto-archives. */
export const ARCHIVE_AFTER_DAYS = Number(process.env.ARCHIVE_AFTER_DAYS ?? 7);

function cutoff() {
  return new Date(Date.now() - ARCHIVE_AFTER_DAYS * 86_400_000);
}

/**
 * Sweep: flag anything finished longer ago than the grace period.
 * Idempotent and indexed — matches nothing on the vast majority of runs, so
 * it is cheap enough to piggyback on the uptime ping.
 */
export async function archiveStaleCompleted() {
  const before = cutoff();

  const [tasks, projects] = await Promise.all([
    prisma.task.updateMany({
      where: { status: TaskStatus.DONE, archivedAt: null, completedAt: { not: null, lt: before } },
      data: { archivedAt: new Date() },
    }),
    // Project has no completedAt, so "completed and untouched since the
    // cutoff" stands in for it.
    prisma.project.updateMany({
      where: { status: ProjectStatus.COMPLETED, archivedAt: null, updatedAt: { lt: before } },
      data: { archivedAt: new Date() },
    }),
  ]);

  return { tasks: tasks.count, projects: projects.count };
}

/** Manually archive or restore a single task. */
export function setTaskArchived(id: string, archived: boolean) {
  return prisma.task.update({
    where: { id },
    data: { archivedAt: archived ? new Date() : null },
  });
}

/** Manually archive or restore a single project. */
export function setProjectArchived(id: string, archived: boolean) {
  return prisma.project.update({
    where: { id },
    data: { archivedAt: archived ? new Date() : null },
  });
}
