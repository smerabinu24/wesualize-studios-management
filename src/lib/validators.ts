import { z } from "zod";
import { EmployeeStatus, ProjectStatus, Priority, TaskStatus, Role } from "@prisma/client";

export const employeeCreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  designation: z.string().min(2),
  departmentId: z.string().optional().nullable(),
  role: z.nativeEnum(Role).default(Role.EMPLOYEE),
  joiningDate: z.coerce.date().optional(),
  status: z.nativeEnum(EmployeeStatus).default(EmployeeStatus.ACTIVE),
  avatarUrl: z.string().url().optional().nullable(),
  weeklyCapacityHours: z.coerce.number().int().min(1).max(80).default(40),
  // Salary data — only writable by callers holding `finance:manage`.
  hourlyRate: z.coerce.number().nonnegative().max(100000).optional().nullable(),
  // Weekly day off, 0 = Sunday … 6 = Saturday.
  weeklyOffDay: z.coerce.number().int().min(0).max(6).optional(),
  password: z.string().min(8).optional(),
});

export const employeeUpdateSchema = employeeCreateSchema.partial().omit({ password: true });

export const clientCreateSchema = z.object({
  clientName: z.string().min(2),
  companyName: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
export const clientUpdateSchema = clientCreateSchema.partial();

/**
 * HTML forms submit "" for any field the user left alone, which broke three
 * things: z.coerce.date("") is an Invalid Date (create failed outright),
 * z.coerce.number("") is 0 (a blank budget silently became ₹0), and an empty
 * clientId reached Prisma as an invalid foreign key.
 *
 * Normalising "" to null fixes all three, and gives edit forms a way to say
 * "clear this field" — absent means leave alone, null means clear.
 */
const blankToNull = (v: unknown) => (v === "" ? null : v);

export const projectCreateSchema = z.object({
  name: z.string().min(2),
  description: z.preprocess(blankToNull, z.string().nullable().optional()),
  clientId: z.preprocess(blankToNull, z.string().nullable().optional()),
  leadId: z.preprocess(blankToNull, z.string().nullable().optional()),
  startDate: z.preprocess(blankToNull, z.coerce.date().nullable().optional()),
  deadline: z.preprocess(blankToNull, z.coerce.date().nullable().optional()),
  budget: z.preprocess(blankToNull, z.coerce.number().nonnegative().nullable().optional()),
  status: z.nativeEnum(ProjectStatus).default(ProjectStatus.PLANNING),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  memberIds: z.array(z.string()).optional(),
});
export const projectUpdateSchema = projectCreateSchema.partial();

export const taskCreateSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional().nullable(),
  projectId: z.string().min(1),
  assigneeId: z.string().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.TODO),
  estimatedHours: z.coerce.number().nonnegative().default(0),
  actualHours: z.coerce.number().nonnegative().default(0),
  /** Extra assignees alongside the primary `assigneeId`. */
  collaboratorIds: z.array(z.string()).optional(),
});
export const taskUpdateSchema = taskCreateSchema
  .partial()
  .omit({ projectId: true })
  .extend({ archived: z.boolean().optional() });

export const projectArchiveSchema = z.object({ archived: z.boolean() });
