import type { Role } from "@prisma/client";

/**
 * Permission catalogue. Authorization is checked against these capabilities,
 * never against role strings directly in feature code.
 */
export type Permission =
  | "employee:manage"
  | "client:manage"
  | "project:manage"
  | "project:manage-assigned"
  | "task:assign"
  | "task:update-own"
  | "analytics:view-all"
  | "analytics:view-team"
  | "report:export"
  | "settings:manage"
  | "audit:view"
  // Pay rates are salary data, so they get their own capabilities rather than
  // riding on analytics. `finance:view` sees aggregate project cost;
  // `finance:manage` sees and sets an individual's hourly rate.
  | "finance:view"
  | "finance:manage";

const MATRIX: Record<Role, Permission[]> = {
  ADMIN: [
    "employee:manage",
    "client:manage",
    "project:manage",
    "project:manage-assigned",
    "task:assign",
    "task:update-own",
    "analytics:view-all",
    "analytics:view-team",
    "report:export",
    "settings:manage",
    "audit:view",
    "finance:view",
    "finance:manage",
  ],
  TEAM_LEAD: [
    "project:manage-assigned",
    "task:assign",
    "task:update-own",
    "analytics:view-team",
    "report:export",
    // Leads see what a project costs, but cannot see or set individual rates.
    "finance:view",
  ],
  EMPLOYEE: ["task:update-own"],
};

export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return MATRIX[role]?.includes(permission) ?? false;
}

export function requirePermission(role: Role | undefined | null, permission: Permission): void {
  if (!can(role, permission)) {
    const err = new Error("Forbidden") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  TEAM_LEAD: "Team Lead",
  EMPLOYEE: "Employee",
};
