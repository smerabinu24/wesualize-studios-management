import { prisma } from "@/lib/prisma";
import { withAuth, ok } from "@/lib/api";
import { clientUpdateSchema } from "@/lib/validators";
import { logActivity } from "@/lib/audit";

export const GET = withAuth("analytics:view-team", async (_req, _ctx, params) => {
  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: { projects: { include: { _count: { select: { tasks: true } } }, orderBy: { createdAt: "desc" } } },
  });
  if (!client) return ok({ error: "Not found" }, 404);
  return ok(client);
});

export const PATCH = withAuth("client:manage", async (req, ctx, params) => {
  const body = clientUpdateSchema.parse(await req.json());
  const client = await prisma.client.update({ where: { id: params.id }, data: { ...body, email: body.email || undefined } });
  await logActivity({ userId: ctx.user.id, action: "client.update", entityType: "Client", entityId: client.id });
  return ok(client);
});

export const DELETE = withAuth("client:manage", async (_req, ctx, params) => {
  await prisma.client.delete({ where: { id: params.id } });
  await logActivity({ userId: ctx.user.id, action: "client.delete", entityType: "Client", entityId: params.id });
  return ok({ ok: true });
});
