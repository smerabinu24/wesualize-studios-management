export const PROJECT_STATUS_LABEL: Record<string, string> = {
  PLANNING: "Planning",
  IN_PROGRESS: "In Progress",
  REVIEW: "Review",
  COMPLETED: "Completed",
  ON_HOLD: "On Hold",
};

export const TASK_STATUS_LABEL: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  REVIEW: "Review",
  DONE: "Done",
};

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "REVIEW", "DONE"] as const;

// Accent color per column (task board headers) — uses chart tokens.
export const TASK_STATUS_DOT: Record<string, string> = {
  TODO: "hsl(var(--muted-foreground))",
  IN_PROGRESS: "hsl(var(--chart-1))",
  REVIEW: "hsl(var(--chart-3))",
  DONE: "hsl(var(--chart-2))",
};

export const PRIORITY_TONE: Record<string, "muted" | "primary" | "warning" | "destructive"> = {
  LOW: "muted",
  MEDIUM: "primary",
  HIGH: "warning",
  CRITICAL: "destructive",
};

export const STATUS_TONE: Record<string, "muted" | "primary" | "warning" | "success" | "destructive"> = {
  PLANNING: "muted",
  IN_PROGRESS: "primary",
  REVIEW: "warning",
  COMPLETED: "success",
  ON_HOLD: "destructive",
};
