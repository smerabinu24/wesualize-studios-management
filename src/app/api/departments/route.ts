import { prisma } from "@/lib/prisma";
import { withAuth, ok } from "@/lib/api";

export const GET = withAuth("task:update-own", async () => {
  const departments = await prisma.department.findMany({ orderBy: { name: "asc" } });
  return ok(departments);
});
