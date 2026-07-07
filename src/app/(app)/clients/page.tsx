import { PageHeader } from "@/components/page-header";
import { ClientsClient } from "./clients-client";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/session";
import { can } from "@/lib/rbac";

export default async function ClientsPage() {
  const user = await requireCan("analytics:view-team");
  const clients = await prisma.client.findMany({
    include: { _count: { select: { projects: true } } },
    orderBy: { clientName: "asc" },
  });
  return (
    <div>
      <PageHeader title="Clients" subtitle="Studio clients and their engagements." />
      <ClientsClient clients={clients} canManage={can(user.role, "client:manage")} />
    </div>
  );
}
