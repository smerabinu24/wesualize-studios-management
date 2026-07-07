import { prisma } from "@/lib/prisma";
import { withAuth, ok } from "@/lib/api";
import { clientCreateSchema } from "@/lib/validators";
import { logActivity } from "@/lib/audit";

export const GET = withAuth("analytics:view-team", async (req) => {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  const clients = await prisma.client.findMany({
    where: q
      ? { OR: [{ clientName: { contains: q, mode: "insensitive" } }, { companyName: { contains: q, mode: "insensitive" } }] }
      : undefined,
    include: { _count: { select: { projects: true } } },
    orderBy: { clientName: "asc" },
  });
  return ok(clients);
});

export const POST = withAuth("client:manage", async (req, ctx) => {
  const body = clientCreateSchema.parse(await req.json());
  const client = await prisma.client.create({
    data: { ...body, email: body.email || null },
  });
  await logActivity({ userId: ctx.user.id, action: "client.create", entityType: "Client", entityId: client.id });
  return ok(client, 201);
});
