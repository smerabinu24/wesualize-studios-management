import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can, type Permission } from "@/lib/rbac";
import type { Role } from "@prisma/client";
import { ZodError } from "zod";

export type Ctx = {
  user: { id: string; role: Role; employeeId: string | null; email?: string | null };
};

/** Wraps a route handler with auth + permission check + error normalization. */
export function withAuth(
  permission: Permission | null,
  handler: (req: Request, ctx: Ctx, params: Record<string, string>) => Promise<NextResponse>
) {
  return async (req: Request, route: { params?: Record<string, string> }) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as Ctx["user"];
    if (permission && !can(user.role, permission)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    try {
      return await handler(req, { user }, route.params ?? {});
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json({ error: "Validation failed", issues: err.flatten() }, { status: 422 });
      }
      const status = (err as { status?: number }).status ?? 500;
      const message = status === 500 ? "Internal server error" : (err as Error).message;
      if (status === 500) console.error(err);
      return NextResponse.json({ error: message }, { status });
    }
  };
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}
