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

export const projectCreateSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  leadId: z.string().optional().nullable(),
  startDate: z.coerce.date().optional(),
  deadline: z.coerce.date().optional().nullable(),
  budget: z.coerce.number().nonnegative().optional().nullable(),
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
});
export const taskUpdateSchema = taskCreateSchema.partial().omit({ projectId: true });
