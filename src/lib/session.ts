import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { can, type Permission } from "@/lib/rbac";

export async function getSession() {
  return getServerSession(authOptions);
}

/** Use in server components / route handlers to require an authenticated user. */
export async function requireUser() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  return session.user;
}

/** Require a specific permission; redirects unauthenticated, 403s for authenticated-but-forbidden. */
export async function requireCan(permission: Permission) {
  const user = await requireUser();
  if (!can(user.role, permission)) {
    const err = new Error("Forbidden") as Error & { status?: number };
    err.status = 403;
    throw err;
  }
  return user;
}
